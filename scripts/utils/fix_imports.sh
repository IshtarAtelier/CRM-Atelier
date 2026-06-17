#!/bin/bash
replace_import() {
  local comp=$1
  local dom=$2
  echo "Replacing $comp to be from $dom"
  find src/app src/components -type f -name "*.tsx" -exec sed -i '' "s|@/components/$comp|@/components/$dom/$comp|g" {} +
  find src/app src/components -type f -name "*.ts" -exec sed -i '' "s|@/components/$comp|@/components/$dom/$comp|g" {} +
  if [ -f "src/components/$comp.tsx" ]; then
    rm "src/components/$comp.tsx"
  fi
}

replace_import "BalancePanel" "dashboard"
replace_import "CopilotChat" "admin"
replace_import "DoctorCommissions" "admin"
replace_import "InvoiceModal" "billing"
replace_import "LabReadyPanel" "dashboard"
replace_import "OpportunitiesPanel" "dashboard"
replace_import "TasksPanel" "dashboard"
replace_import "Sidebar" "layout"
replace_import "UserProfile" "admin"
replace_import "GlobalBalanceReminders" "dashboard"
replace_import "GlobalLabReady" "dashboard"
replace_import "GlobalOpportunities" "dashboard"
replace_import "GlobalReviewRequests" "dashboard"
replace_import "GlobalTasks" "dashboard"
replace_import "ReviewRequestsPanel" "dashboard"
