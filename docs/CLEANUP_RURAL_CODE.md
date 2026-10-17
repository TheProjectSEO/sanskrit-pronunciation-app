# 🧹 Cleanup Instructions: Removing Rural Code from Main Tapaswe Project

**Date:** 2026-02-15
**Status:** Rural app is now a separate standalone project

The rural schools app has been moved to a completely separate project: `tapaswe-rural-app/`

This document explains how to clean up the rural-specific code from the main Tapaswe project.

---

## ✅ What Was Separated

The rural app is now at: `/Users/adityaaman/Desktop/Projects/Tapaswe/tapaswe-rural-app/`

It includes:
- All rural frontend pages (`app/rural/`)
- All rural API routes (`app/api/rural/`)
- Rural database schema (`docs/database_schema.sql`)
- Complete documentation
- Own dependencies and configuration

---

## 🗑️ Optional Cleanup Steps

You can safely remove these from the main Tapaswe project if you want:

### 1. Remove Rural Frontend Pages
```bash
cd /Users/adityaaman/Desktop/Projects/Tapaswe/tapaswe-app
rm -rf app/rural
```

### 2. Remove Rural API Routes
```bash
rm -rf app/api/rural
```

### 3. Remove Rural Documentation
```bash
rm -f docs/RURAL_*.md
rm -f docs/database_schema.sql
```

### 4. Remove Rural Migrations (Optional)
```bash
# These are harmless to keep, but can be removed:
rm -f supabase/migrations/008_rural_schools_schema.sql
rm -f supabase/migrations/009_rural_schools_schema_fixed.sql
```

### 5. Remove Test Data Script
```bash
rm -f scripts/seed-rural-test-data.sql
```

---

## 📊 Database Tables

**IMPORTANT:** The database tables are shared between both projects.

### Tables Used by Rural App:
- `rural_schools`
- `rural_classes`
- `rural_students`
- `rural_practice_sessions`
- `rural_class_progress`
- `curriculum_mantras` (shared with main app)

### What to Do:
- ✅ **Keep the tables** - They don't conflict with main app
- ✅ **Keep curriculum_mantras** - Used by both apps
- ⚠️ **Don't drop tables** - Rural app needs them

The tables are prefixed with `rural_` so they don't conflict with anything in the main Tapaswe app.

---

## 🔄 If You Need to Recreate Rural App

If you accidentally delete the rural app or need to start fresh:

1. Copy from the main project:
```bash
cp -r tapaswe-app/app/rural tapaswe-rural-app/app/
cp -r tapaswe-app/app/api/rural tapaswe-rural-app/app/api/
```

2. Or just clone from the backup (if you've pushed to git)

---

## ✅ Verification Checklist

After cleanup, verify main Tapaswe app still works:

```bash
cd /Users/adityaaman/Desktop/Projects/Tapaswe/tapaswe-app
npm run build  # Should compile successfully
npm run dev    # Should start on port 3003
```

Main app pages that should still work:
- http://localhost:3003 - Homepage
- http://localhost:3003/signin - Sign in
- http://localhost:3003/practice/[id] - Practice page
- http://localhost:3003/instructor - Instructor dashboard

---

## 🚀 Running Both Apps Simultaneously

Main Tapaswe App:
```bash
cd /Users/adityaaman/Desktop/Projects/Tapaswe/tapaswe-app
npm run dev  # Runs on port 3003
```

Rural App:
```bash
cd /Users/adityaaman/Desktop/Projects/Tapaswe/tapaswe-rural-app
npm run dev  # Runs on port 3004
```

Both can run at the same time without conflicts!

---

## 📝 Future Deployment

### Main Tapaswe App
- Deploy to: `tapaswe.com` or `app.tapaswe.com`
- Target: Premium users, urban schools
- Features: Full AI analysis, instructor uploads, recording

### Rural App
- Deploy to: `rural.tapaswe.com` or `sanskritshiksha.gov.in`
- Target: Government schools, rural areas
- Features: Offline-first, browser TTS, teacher-led

---

## ⚠️ Important Notes

1. **Don't remove database tables** - Both apps need them
2. **curriculum_mantras is shared** - Used by both apps
3. **Keep .env.local** - Both apps use same Supabase project
4. **Separate git repos recommended** - Use different repos for better management

---

## 🎉 Benefits of Separation

✅ **No conflicts** - Each app has its own codebase
✅ **Independent scaling** - Deploy separately
✅ **Clean separation** - Rural features don't clutter main app
✅ **Different dependencies** - Rural app is lighter
✅ **Easier maintenance** - Clear boundaries
✅ **Better testing** - Test each app independently

---

**The rural app is now 100% separate and ready for production!** 🚀
