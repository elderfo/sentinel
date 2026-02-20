# Auth0 RBAC Setup for Sentinel

This document explains how to configure Auth0 Role-Based Access Control (RBAC) for the Sentinel
platform so that roles and permissions are included in access tokens and enforced by the API.

## Overview

Sentinel uses three roles and six permissions. Roles group permissions so that users receive the
correct access level without requiring per-user permission assignment.

| Role     | Permissions granted                   |
| -------- | ------------------------------------- |
| admin    | All permissions                       |
| engineer | tests:create, tests:run, results:read |
| viewer   | results:read                          |

Permissions:

| Permission         | Description                           |
| ------------------ | ------------------------------------- |
| tests:create       | Create new test scenarios             |
| tests:run          | Execute test runs                     |
| tests:delete       | Delete test scenarios                 |
| results:read       | View test results and reports         |
| settings:manage    | Manage platform settings              |
| credentials:manage | Manage stored credentials and secrets |

---

## Step 1: Define permissions in the Auth0 API settings

Permissions must be defined on the API that represents your Sentinel backend before they can be
assigned to roles.

1. Log in to the [Auth0 Dashboard](https://manage.auth0.com/).
2. Navigate to **Applications > APIs**.
3. Open the API you created for Sentinel (identified by the `AUTH0_AUDIENCE` value).
4. Select the **Permissions** tab.
5. Add each of the following permissions with a meaningful description:

   | Permission         | Description                           |
   | ------------------ | ------------------------------------- |
   | tests:create       | Create new test scenarios             |
   | tests:run          | Execute test runs                     |
   | tests:delete       | Delete test scenarios                 |
   | results:read       | View test results and reports         |
   | settings:manage    | Manage platform settings              |
   | credentials:manage | Manage stored credentials and secrets |

6. Click **Save** after adding all permissions.

---

## Step 2: Enable RBAC and add permissions to access tokens

By default, Auth0 does not include permissions in access tokens. You must enable this setting on
the API.

1. In the Auth0 Dashboard, navigate to **Applications > APIs**.
2. Open your Sentinel API.
3. Select the **Settings** tab.
4. Scroll to the **RBAC Settings** section.
5. Enable the toggle **Enable RBAC**.
6. Enable the toggle **Add Permissions in the Access Token**.
7. Click **Save Changes**.

With this setting active, the `permissions` claim will be included in every access token issued
for this API, containing only the permissions the user has been granted through their assigned
roles.

---

## Step 3: Create roles in the Auth0 Dashboard

1. In the Auth0 Dashboard, navigate to **User Management > Roles**.
2. Click **Create Role** and create the following three roles:
   - **Name:** `admin`
     **Description:** Full administrative access to the Sentinel platform.

   - **Name:** `engineer`
     **Description:** Can create and run tests and view results.

   - **Name:** `viewer`
     **Description:** Read-only access to test results.

3. After creating each role, open it and select the **Permissions** tab.
4. Click **Add Permissions**, select your Sentinel API from the dropdown, and add the permissions
   that correspond to the table in the Overview section above.
5. Click **Add Permissions** to confirm.

---

## Step 4: Assign roles to users

1. In the Auth0 Dashboard, navigate to **User Management > Users**.
2. Search for or select the user you want to assign a role to.
3. Select the **Roles** tab.
4. Click **Assign Roles**.
5. Select the appropriate role (`admin`, `engineer`, or `viewer`) and click **Assign**.

The user's next access token will include the permissions associated with their assigned role in
the `permissions` claim.

---

## Verifying the setup

After completing the steps above, you can verify the configuration by inspecting an access token:

1. Obtain an access token for a user with an assigned role using your preferred Auth0 flow.
2. Decode the token at [jwt.io](https://jwt.io/).
3. Confirm the payload contains a `permissions` array with the expected values. For example, a
   user with the `engineer` role should see:

   ```json
   {
     "permissions": ["tests:create", "tests:run", "results:read"]
   }
   ```

If the `permissions` array is absent, verify that the **Add Permissions in the Access Token**
setting is enabled on the API (Step 2).

---

## Local development

For local development you can skip real Auth0 integration by using a local JWKS fixture in tests.
The `createRbacMiddleware`, `requireRole`, and `requirePermission` functions in `@sentinel/core`
work against the same `AuthUser` type regardless of how the token was issued, so any test that
injects a properly shaped user object will exercise the RBAC logic without network calls.

See `packages/core/src/__tests__/rbac.test.ts` for examples of how to sign test JWTs with a
local key pair using the `jose` library.
