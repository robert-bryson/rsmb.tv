#!/usr/bin/env bash
# aws-status.sh — Quick AWS status dashboard for rsmb.tv
# Usage: ./scripts/aws-status.sh [--profile PROFILE] [--region REGION]
set -euo pipefail

PROFILE="${AWS_PROFILE:-rsmbtv-admin}"
REGION="${AWS_REGION:-us-east-1}"
APP_ID="d38ki8k4lanh8s"
CF_DIST_ID="E396BD4LQ9URTA"

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --profile) PROFILE="$2"; shift 2 ;;
    --region)  REGION="$2";  shift 2 ;;
    *)         echo "Unknown arg: $1"; exit 1 ;;
  esac
done

AWS="aws --profile $PROFILE --region $REGION --output json"

bold="\033[1m"
dim="\033[2m"
green="\033[32m"
red="\033[31m"
yellow="\033[33m"
cyan="\033[36m"
reset="\033[0m"

hr() { printf "${dim}─%.0s${reset}" $(seq 1 60); echo; }

# ─── Cost ────────────────────────────────────────────────────────────────────

echo -e "\n${bold}💰 Cost — Current Month${reset}"
hr

MONTH_START=$(date -u +%Y-%m-01)
TODAY=$(date -u +%Y-%m-%d)

cost_json=$($AWS ce get-cost-and-usage \
  --time-period "Start=$MONTH_START,End=$TODAY" \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE 2>/dev/null) || { echo "  (cost data unavailable)"; cost_json=""; }

if [[ -n "$cost_json" ]]; then
  echo "$cost_json" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for period in data['ResultsByTime']:
    groups = sorted(period['Groups'], key=lambda g: float(g['Metrics']['BlendedCost']['Amount']), reverse=True)
    total = 0
    for g in groups:
        amt = float(g['Metrics']['BlendedCost']['Amount'])
        if amt > 0.001:
            total += amt
            print(f'  {g[\"Keys\"][0]:40s}  \${amt:.2f}')
    print(f'  {\"\":40s}  ──────')
    print(f'  {\"Total\":40s}  \${total:.2f}')
"
fi

# Forecast
forecast_json=$($AWS ce get-cost-forecast \
  --time-period "Start=$TODAY,End=$(date -u -d '+1 month' +%Y-%m-01 2>/dev/null || date -u -v+1m -v1d +%Y-%m-%d)" \
  --granularity MONTHLY \
  --metric BLENDED_COST 2>/dev/null) || forecast_json=""

if [[ -n "$forecast_json" ]]; then
  forecast=$(echo "$forecast_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"\${float(d['Total']['Amount']):.2f}\")")
  echo -e "  ${dim}Forecast:${reset} ${cyan}$forecast${reset}"
fi

# ─── Amplify ─────────────────────────────────────────────────────────────────

echo -e "\n${bold}🚀 Amplify — Recent Builds${reset}"
hr

builds_json=$($AWS amplify list-jobs --app-id "$APP_ID" --branch-name main --max-items 5 2>/dev/null) || builds_json=""

if [[ -n "$builds_json" ]]; then
  echo "$builds_json" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for j in data.get('jobSummaries', []):
    status = j['status']
    color = '\033[32m' if status == 'SUCCEED' else '\033[31m' if status in ('FAILED','CANCELLED') else '\033[33m'
    start = j.get('startTime','?')[:19]
    end = j.get('endTime','?')[:19]
    print(f'  #{j[\"jobId\"]:4s}  {color}{status:10s}\033[0m  {start}')
"
fi

# ─── CloudFront ──────────────────────────────────────────────────────────────

echo -e "\n${bold}🌐 CloudFront — Apex Redirect${reset}"
hr

cf_json=$($AWS cloudfront get-distribution --id "$CF_DIST_ID" 2>/dev/null) || cf_json=""

if [[ -n "$cf_json" ]]; then
  echo "$cf_json" | python3 -c "
import sys, json
d = json.load(sys.stdin)['Distribution']
status = d['Status']
color = '\033[32m' if status == 'Deployed' else '\033[33m'
print(f'  Status:  {color}{status}\033[0m')
print(f'  Domain:  {d[\"DomainName\"]}')
print(f'  HTTP:    {d[\"DistributionConfig\"][\"HttpVersion\"]}')
"
fi

# ─── CloudWatch Alarms ──────────────────────────────────────────────────────

echo -e "\n${bold}🔔 CloudWatch Alarms${reset}"
hr

alarms_json=$($AWS cloudwatch describe-alarms --alarm-name-prefix rsmbtv 2>/dev/null) || alarms_json=""

if [[ -n "$alarms_json" ]]; then
  alarm_count=$(echo "$alarms_json" | python3 -c "
import sys, json
data = json.load(sys.stdin)
alarms = data.get('MetricAlarms', [])
if not alarms:
    print('  No alarms configured')
else:
    for a in alarms:
        state = a['StateValue']
        color = '\033[32m' if state == 'OK' else '\033[31m' if state == 'ALARM' else '\033[33m'
        print(f'  {a[\"AlarmName\"]:40s}  {color}{state}\033[0m')
")
  echo "$alarm_count"
else
  echo "  (no alarms found)"
fi

# ─── Health Checks ──────────────────────────────────────────────────────────

echo -e "\n${bold}❤️  Route 53 Health Checks${reset}"
hr

hc_json=$($AWS route53 list-health-checks 2>/dev/null) || hc_json=""

if [[ -n "$hc_json" ]]; then
  echo "$hc_json" | python3 -c "
import sys, json, subprocess
data = json.load(sys.stdin)
checks = data.get('HealthChecks', [])
if not checks:
    print('  No health checks configured')
for hc in checks:
    hc_id = hc['Id']
    fqdn = hc['HealthCheckConfig'].get('FullyQualifiedDomainName', '?')
    # Get status
    try:
        result = subprocess.run(
            ['aws', '--profile', '$PROFILE', '--region', '$REGION', '--output', 'json',
             'route53', 'get-health-check-status', '--health-check-id', hc_id],
            capture_output=True, text=True, timeout=10)
        status_data = json.loads(result.stdout)
        statuses = status_data.get('HealthCheckObservations', [])
        healthy = sum(1 for s in statuses if s.get('StatusReport', {}).get('Status', '').startswith('Success'))
        total = len(statuses)
        color = '\033[32m' if healthy == total else '\033[31m' if healthy == 0 else '\033[33m'
        print(f'  {fqdn:40s}  {color}{healthy}/{total} checkers healthy\033[0m')
    except Exception:
        print(f'  {fqdn:40s}  (status unavailable)')
"
fi

echo ""
