#!/usr/bin/env bash
# aws-status.sh — Quick AWS status dashboard for rsmb.tv
# Usage: ./scripts/aws-status.sh [--profile PROFILE] [--region REGION] [--costs] [--watch [SECS]]
set -euo pipefail

PROFILE="${AWS_PROFILE:-rsmbtv-admin}"
REGION="${AWS_REGION:-us-east-1}"
APP_ID="d38ki8k4lanh8s"
CF_DIST_ID="E396BD4LQ9URTA"
SHOW_COSTS=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_DIR/.env.local"
ENV_FLAG=()
[[ -f "$ENV_FILE" ]] && ENV_FLAG=(--env-file="$ENV_FILE")

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --profile) PROFILE="$2"; shift 2 ;;
    --region)  REGION="$2";  shift 2 ;;
    --costs)   SHOW_COSTS=true; shift ;;
    --watch)
      shift
      INTERVAL=60
      [[ "${1:-}" =~ ^[0-9]+$ ]] && { INTERVAL="$1"; shift; }
      exec node "${ENV_FLAG[@]}" --import tsx/esm "$SCRIPT_DIR/aws-watch.tsx" --profile "$PROFILE" --region "$REGION" --interval "$INTERVAL"
      ;;
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
white="\033[97m"
reset="\033[0m"

hr() { printf "${dim}─%.0s${reset}" $(seq 1 60); echo; }

# ─── Detailed Cost View ─────────────────────────────────────────────────────

if [[ "$SHOW_COSTS" == true ]]; then
  exec node "${ENV_FLAG[@]}" --import tsx/esm "$SCRIPT_DIR/aws-costs.ts" --profile "$PROFILE" --region "$REGION" --detail
fi

# ─── Watch mode wrapper ──────────────────────────────────────────────────────

run_dashboard() {

# ─── Cost ────────────────────────────────────────────────────────────────────

node "${ENV_FLAG[@]}" --import tsx/esm "$SCRIPT_DIR/aws-costs.ts" --profile "$PROFILE" --region "$REGION" --summary \
  || echo -e "  ${red}(cost data unavailable)${reset}"

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

} # end run_dashboard

run_dashboard
