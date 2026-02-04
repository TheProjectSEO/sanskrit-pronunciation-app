#!/usr/bin/env python3
"""Fix RLS migration to be idempotent by adding DROP POLICY IF EXISTS before each CREATE POLICY"""

import re

# Read the migration file
with open('supabase/migrations/003_add_rls_policies.sql', 'r') as f:
    content = f.read()

# Pattern to match CREATE POLICY statements
# Captures the policy name and table name
pattern = r'CREATE POLICY "([^"]+)"\s+ON\s+(\w+)'

def add_drop_policy(match):
    policy_name = match.group(1)
    table_name = match.group(2)
    return f'DROP POLICY IF EXISTS "{policy_name}" ON {table_name};\nCREATE POLICY "{policy_name}"\nON {table_name}'

# Replace all CREATE POLICY with DROP + CREATE
fixed_content = re.sub(pattern, add_drop_policy, content)

# Write back
with open('supabase/migrations/003_add_rls_policies.sql', 'w') as f:
    f.write(fixed_content)

print("✓ Fixed RLS migration to be idempotent")
print("✓ Added DROP POLICY IF EXISTS before each CREATE POLICY")
