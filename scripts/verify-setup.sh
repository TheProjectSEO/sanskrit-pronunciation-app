#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Verifying Tapaswe App Setup..."
echo ""

# Check if .env.local exists
if [ -f .env.local ]; then
    echo -e "${GREEN}✓${NC} .env.local file exists"
else
    echo -e "${RED}✗${NC} .env.local file not found"
    echo "  Please create .env.local with required variables"
    exit 1
fi

# Check required environment variables
REQUIRED_VARS=(
    "NEXTAUTH_URL"
    "NEXTAUTH_SECRET"
    "GOOGLE_CLIENT_ID"
    "GOOGLE_CLIENT_SECRET"
    "NEXT_PUBLIC_SUPABASE_URL"
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    "SUPABASE_SERVICE_ROLE_KEY"
    "SUPABASE_JWT_SECRET"
    "EMAILJS_SERVICE_ID"
    "EMAILJS_TEMPLATE_ID"
    "EMAILJS_PUBLIC_KEY"
    "OPENAI_API_KEY"
)

MISSING_VARS=()
PLACEHOLDER_VARS=()

for VAR in "${REQUIRED_VARS[@]}"; do
    VALUE=$(grep "^$VAR=" .env.local | cut -d '=' -f2-)

    if [ -z "$VALUE" ]; then
        MISSING_VARS+=("$VAR")
        echo -e "${RED}✗${NC} $VAR is not set"
    elif [[ "$VALUE" == *"your-"* ]] || [[ "$VALUE" == *"change-this"* ]]; then
        PLACEHOLDER_VARS+=("$VAR")
        echo -e "${YELLOW}⚠${NC} $VAR has placeholder value"
    else
        echo -e "${GREEN}✓${NC} $VAR is set"
    fi
done

echo ""

# Check if node_modules exists
if [ -d node_modules ]; then
    echo -e "${GREEN}✓${NC} node_modules directory exists"
else
    echo -e "${YELLOW}⚠${NC} node_modules not found"
    echo "  Run: npm install"
fi

echo ""

# Summary
if [ ${#MISSING_VARS[@]} -eq 0 ] && [ ${#PLACEHOLDER_VARS[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ All environment variables are configured!${NC}"
    echo ""
    echo "You can now run:"
    echo "  npm run dev"
    echo ""
    echo "And visit: http://localhost:3000"
else
    echo -e "${RED}⚠️  Setup incomplete${NC}"

    if [ ${#MISSING_VARS[@]} -gt 0 ]; then
        echo ""
        echo "Missing variables:"
        for VAR in "${MISSING_VARS[@]}"; do
            echo "  - $VAR"
        done
    fi

    if [ ${#PLACEHOLDER_VARS[@]} -gt 0 ]; then
        echo ""
        echo "Variables with placeholder values (need to be updated):"
        for VAR in "${PLACEHOLDER_VARS[@]}"; do
            echo "  - $VAR"
        done
    fi

    echo ""
    echo "Please update .env.local and run this script again."
fi
