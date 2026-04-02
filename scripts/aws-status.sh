#!/usr/bin/env bash
# aws-status.sh — Quick AWS status dashboard for rsmb.tv
# Usage: ./scripts/aws-status.sh [--profile PROFILE] [--region REGION] [--costs] [--watch [SECS]]
set -euo pipefail

PROFILE="${AWS_PROFILE:-rsmbtv-admin}"
REGION="${AWS_REGION:-us-east-1}"
APP_ID="d38ki8k4lanh8s"
CF_DIST_ID="E396BD4LQ9URTA"
SHOW_COSTS=false

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
      SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
      ENV_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.env.local"
      ENV_FLAG=""
      [[ -f "$ENV_FILE" ]] && ENV_FLAG="--env-file=$ENV_FILE"
      exec node $ENV_FLAG --import tsx/esm "$SCRIPT_DIR/aws-watch.tsx" --profile "$PROFILE" --region "$REGION" --interval "$INTERVAL"
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
  TODAY=$(date -u +%Y-%m-%d)
  THIS_MONTH_START=$(date -u +%Y-%m-01)
  NEXT_MONTH_START=$(date -u -d '+1 month' +%Y-%m-01 2>/dev/null || date -u -v+1m -v1d +%Y-%m-%d)
  LAST_MONTH_START=$(date -u -d '-1 month' +%Y-%m-01 2>/dev/null || date -u -v-1m -v1d +%Y-%m-%d)
  TWO_MONTHS_AGO_START=$(date -u -d '-2 months' +%Y-%m-01 2>/dev/null || date -u -v-2m -v1d +%Y-%m-%d)

  THIS_MONTH_NAME=$(date -u "+%b %Y")
  LAST_MONTH_NAME=$(date -u -d '-1 month' "+%b %Y" 2>/dev/null || date -u -v-1m "+%b %Y")
  TWO_MONTHS_AGO_NAME=$(date -u -d '-2 months' "+%b %Y" 2>/dev/null || date -u -v-2m "+%b %Y")

  # Fetch two-months-ago costs
  two_months_json=$($AWS ce get-cost-and-usage \
    --time-period "Start=$TWO_MONTHS_AGO_START,End=$LAST_MONTH_START" \
    --granularity MONTHLY \
    --metrics BlendedCost \
    --group-by Type=DIMENSION,Key=SERVICE 2>/dev/null) || two_months_json=""

  # Fetch last month costs
  last_month_json=$($AWS ce get-cost-and-usage \
    --time-period "Start=$LAST_MONTH_START,End=$THIS_MONTH_START" \
    --granularity MONTHLY \
    --metrics BlendedCost \
    --group-by Type=DIMENSION,Key=SERVICE 2>/dev/null) || last_month_json=""

  # Fetch this month costs (to-date)
  this_month_json=$($AWS ce get-cost-and-usage \
    --time-period "Start=$THIS_MONTH_START,End=$TODAY" \
    --granularity MONTHLY \
    --metrics BlendedCost \
    --group-by Type=DIMENSION,Key=SERVICE 2>/dev/null) || this_month_json=""

  # Fetch forecast
  forecast_json=$($AWS ce get-cost-forecast \
    --time-period "Start=$TODAY,End=$NEXT_MONTH_START" \
    --granularity MONTHLY \
    --metric BLENDED_COST 2>/dev/null) || forecast_json=""

  # Render everything with a single Python script for clean formatting
  python3 -c "
import sys, json

bold   = '\033[1m'
dim    = '\033[2m'
green  = '\033[32m'
red    = '\033[31m'
yellow = '\033[33m'
cyan   = '\033[36m'
white  = '\033[97m'
reset  = '\033[0m'

two_months_ago_name = '$TWO_MONTHS_AGO_NAME'
last_month_name     = '$LAST_MONTH_NAME'
this_month_name     = '$THIS_MONTH_NAME'

def parse_costs(raw):
    if not raw:
        return {}, 0.0
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {}, 0.0
    services = {}
    total = 0.0
    for period in data.get('ResultsByTime', []):
        for g in period.get('Groups', []):
            amt = float(g['Metrics']['BlendedCost']['Amount'])
            if amt > 0.001:
                name = g['Keys'][0]
                services[name] = services.get(name, 0.0) + amt
                total += amt
    return services, total

def parse_forecast(raw):
    if not raw:
        return None
    try:
        data = json.loads(raw)
        return float(data['Total']['Amount'])
    except (json.JSONDecodeError, KeyError, TypeError):
        return None

def fmt(amount):
    return f'\${amount:,.2f}'

two_svcs,  two_total    = parse_costs('''$two_months_json''')
last_svcs, last_total   = parse_costs('''$last_month_json''')
this_svcs, this_total   = parse_costs('''$this_month_json''')
forecast_amt            = parse_forecast('''$forecast_json''')
forecast_total          = (this_total + forecast_amt) if forecast_amt is not None else None

# Distribute forecast proportionally across services by MTD share
svc_forecasts = {}
if forecast_total is not None and this_total > 0.001:
    for svc, amt in this_svcs.items():
        svc_forecasts[svc] = (amt / this_total) * forecast_total

# ── Service Breakdown Table ──
all_services = sorted(set(
    list(two_svcs.keys()) + list(last_svcs.keys()) + list(this_svcs.keys())
))

if all_services:
    SN = 32  # service name width
    AW = 10  # amount column width
    NC = 4   # data columns
    TW = SN + (AW + 2) * NC + 4  # total rule width

    print()
    print(f'{bold}  Service Breakdown{reset}')
    print(f'  {dim}{\"─\" * TW}{reset}')
    print(f'  {dim}{\"Service\":<{SN}}  {two_months_ago_name:>{AW}}  {last_month_name:>{AW}}  {\"MTD\":>{AW}}  {\"Forecast\":>{AW}}{reset}')
    print(f'  {dim}{\"─\" * TW}{reset}')

    for svc in all_services:
        two_amt  = two_svcs.get(svc, 0.0)
        last_amt = last_svcs.get(svc, 0.0)
        this_amt = this_svcs.get(svc, 0.0)
        fc_amt   = svc_forecasts.get(svc, 0.0)

        # Trend: compare projected forecast vs last month
        if last_amt > 0.001 and fc_amt > 0.001:
            if fc_amt > last_amt * 1.1:
                trend = f'{red}▲{reset}'
            elif fc_amt < last_amt * 0.9:
                trend = f'{green}▼{reset}'
            else:
                trend = f'{dim}─{reset}'
        elif fc_amt > 0.001:
            trend = f'{yellow}●{reset}'
        else:
            trend = ' '

        svc_display = (svc[:SN - 2] + '..') if len(svc) > SN else svc

        two_str  = f'{fmt(two_amt):>{AW}}'  if two_amt  > 0.001 else f'{dim}{\"—\":>{AW}}{reset}'
        last_str = f'{fmt(last_amt):>{AW}}' if last_amt > 0.001 else f'{dim}{\"—\":>{AW}}{reset}'
        mtd_str  = f'{fmt(this_amt):>{AW}}' if this_amt > 0.001 else f'{dim}{\"—\":>{AW}}{reset}'
        fc_str   = f'{fmt(fc_amt):>{AW}}'   if fc_amt   > 0.001 else f'{dim}{\"—\":>{AW}}{reset}'

        print(f'  {svc_display:<{SN}}  {two_str}  {last_str}  {mtd_str}  {fc_str}  {trend}')

    print(f'  {dim}{\"─\" * TW}{reset}')
    fc_total_str = fmt(forecast_total) if forecast_total is not None else f'{\"—\":>{AW}}'
    print(f'  {bold}{\"Total\":<{SN}}{reset}  {white}{fmt(two_total):>{AW}}{reset}  {white}{fmt(last_total):>{AW}}{reset}  {cyan}{fmt(this_total):>{AW}}{reset}  {yellow}{fc_total_str:>{AW}}{reset}')

# ── Summary Card ──
CW = 15  # column content width
C  = CW + 2  # column width with padding
NC = 4   # number of columns
W  = C * NC + (NC - 1)  # total inner width

print()
print(f'{dim}╭{\"─\" * W}╮{reset}')
title = '  AWS Cost Overview'
print(f'{dim}│{reset}{bold}{title}{\" \" * (W - len(title))}{reset}{dim}│{reset}')
sep = f'{dim}├' + '┬'.join(['─' * C] * NC) + f'┤{reset}'
print(sep)

headers = [two_months_ago_name, last_month_name, 'MTD', 'Forecast']
hline = f'{dim}│{reset}'
for h in headers:
    hline += f' {dim}{h:^{CW}}{reset} {dim}│{reset}'
print(hline)

vals = [
    (white,  fmt(two_total)),
    (white,  fmt(last_total)),
    (cyan,   fmt(this_total)),
    (yellow, fmt(forecast_total) if forecast_total is not None else '—'),
]
vline = f'{dim}│{reset}'
for color, v in vals:
    vline += f' {color}{v:^{CW}}{reset} {dim}│{reset}'
print(vline)

# Forecast vs last month delta
if last_total > 0 and forecast_total is not None:
    delta = forecast_total - last_total
    pct = (delta / last_total) * 100
    if delta > 0:
        arrow = f'{red}▲ +{fmt(delta)} ({pct:+.0f}%){reset}'
    elif delta < 0:
        arrow = f'{green}▼ {fmt(delta)} ({pct:+.0f}%){reset}'
    else:
        arrow = f'{dim}— no change{reset}'
    print(f'{dim}├{\"─\" * W}┤{reset}')
    print(f'{dim}│{reset}  Forecast vs {last_month_name}: {arrow}')

print(f'{dim}╰{\"─\" * W}╯{reset}')

print()
" 2>&1 || echo -e "  ${red}(cost data unavailable)${reset}"

  exit 0
fi

# ─── Watch mode wrapper ──────────────────────────────────────────────────────

run_dashboard() {

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

} # end run_dashboard

run_dashboard
