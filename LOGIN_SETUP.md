# Login Setup Changes

## Overview
Modified the authentication system to remove user registration form and display only login form. The admin user is now created via environment variables (seed) instead of through the UI.

## Changes Made

### 1. Docker Compose Configuration (`docker-compose.yaml`)
Added environment variables for admin user creation and disabled signup:
- `WEBUI_ADMIN_EMAIL=admin@example.com`
- `WEBUI_ADMIN_PASSWORD=admin123`
- `WEBUI_ADMIN_NAME=Admin`
- `ENABLE_SIGNUP=false`

### 2. Authentication Page (`src/routes/auth/+page.svelte`)
Removed all signup/onboarding functionality:
- Removed signup mode, LDAP mode, and onboarding components
- Simplified to always show login form with email and password fields
- Removed name field, confirm password field, and mode tabs
- Removed OnBoarding component import and usage
- Removed unused imports and handlers (signUpHandler, ldapSignInHandler)
- Removed conditional logic for form display based on runtime config
- Simplified submit handler to only handle sign-in

### 3. Admin User Creation
The admin user is now automatically created on first startup using the environment variables:
- Email: admin@example.com
- Password: admin123
- Name: Admin
- Role: admin (automatically assigned as first user)

## Usage

### Starting the Application
```bash
docker-compose up -d
```

### First Login
1. Navigate to `http://localhost:8081/auth`
2. You will see only a login form (no signup option)
3. Login with:
   - Email: `admin@example.com`
   - Password: `admin123`

### Admin User Management
After the first login, the admin can:
- Create additional users through Admin Panel > Users
- Manage user roles and permissions
- Change user passwords

## Security Notes
- Change the default admin password in production
- Update `WEBUI_ADMIN_EMAIL` and `WEBUI_ADMIN_PASSWORD` in docker-compose.yaml
- The admin account is only created if no users exist in the database
- Public signup is disabled via `ENABLE_SIGNUP=false`

## Configuration Options
To customize the admin credentials, modify these environment variables in `docker-compose.yaml`:
- `WEBUI_ADMIN_EMAIL`: Admin email address
- `WEBUI_ADMIN_PASSWORD`: Admin password
- `WEBUI_ADMIN_NAME`: Admin display name

## Database Schema
The system maintains the separation between `user` (profile data) and `auth` (authentication data) tables as documented in `ROLE_AND_AUTH_SETUP.md`.
