# Auth0 MFA Setup for Sentinel

This document describes how to configure multi-factor authentication (MFA) enforcement in your Auth0 tenant for use with Sentinel, and explains how Sentinel handles MFA errors at runtime.

## Enabling MFA in Auth0

1. Log in to the [Auth0 Dashboard](https://manage.auth0.com).
2. Navigate to **Security > Multi-factor Auth**.
3. Enable MFA for your tenant by toggling the switch to **On**.
4. Select the MFA factors you want to make available to users.

## Recommended MFA Factors

Auth0 supports several MFA factors. The following are recommended for Sentinel:

- **Auth0 Guardian** — a push notification app maintained by Auth0. It provides a good user experience and supports biometric approval on mobile devices. This is the preferred option for user-facing applications.
- **TOTP (Time-based One-Time Password)** — compatible with authenticator apps such as Google Authenticator, Authy, and 1Password. Use this as a fallback or as an option for users who prefer hardware tokens or existing authenticator setups.

Do not use SMS OTP as a primary factor in high-assurance environments. SMS is susceptible to SIM-swapping attacks. If SMS is offered, treat it as a second-choice fallback rather than a default.

## Configuring MFA Policies

Auth0 supports two main policy modes for MFA enforcement:

### Always require MFA

All users must complete MFA on every login, regardless of context.

In the Auth0 Dashboard, under **Security > Multi-factor Auth**, set the policy to **Always**.

This is the recommended setting for Sentinel's production environment and any environment where sensitive QA data or automation credentials are accessible.

### Adaptive MFA (risk-based)

Auth0 can apply MFA selectively based on signals such as unusual login location, new device, or unusual access patterns.

In the Auth0 Dashboard, under **Security > Multi-factor Auth**, set the policy to **Adaptive**. Review and configure the risk factors to match your organization's threat model.

Note that adaptive MFA does not guarantee that every token carries an `amr: ["mfa"]` claim, because some low-risk sessions will not trigger an MFA challenge. If Sentinel requires unconditional MFA enforcement, use the **Always** policy.

### Requiring MFA for specific APIs via Auth0 Actions

For finer-grained control, use an Auth0 Action in the **Login flow** to conditionally require MFA based on the requested audience or application:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  if (event.resource_server?.identifier === 'https://api.yoursentineldomain.com') {
    api.multifactor.enable('any');
  }
};
```

This ensures that MFA is only enforced for token requests targeting the Sentinel API, without affecting other applications on the same tenant.

## How Sentinel Handles MFA Errors

### Token inspection

After a user authenticates and obtains an access token, Sentinel inspects the token's `amr` (Authentication Methods Reference) claim. When MFA was completed during the login flow, Auth0 includes `"mfa"` in the `amr` array.

Sentinel's `createMfaEnforcementMiddleware` (in `@sentinel/core`) inspects the `amr` claim:

- If `amr` includes `"mfa"`, the request is allowed to proceed.
- If `amr` is absent or does not contain `"mfa"`, the middleware returns a `MfaChallengeResult` with status `"required"`.

### OAuth token exchange errors

When a client application attempts to exchange an authorization code or refresh token for an access token and Auth0 requires MFA, Auth0 returns a structured error body:

```json
{
  "error": "mfa_required",
  "mfa_token": "<short-lived-mfa-token>",
  "error_description": "MFA is required"
}
```

Sentinel's `parseMfaErrorResponse` (in `@sentinel/core`) converts this raw response body into a typed `MfaChallengeResult`. Clients should pass the `mfa_token` back to Auth0's `/mfa/challenge` endpoint to begin the MFA flow.

### MFA error codes

Sentinel defines the following MFA error codes in `MFA_ERROR_CODES` (exported from `@sentinel/shared`):

| Code                      | Meaning                                                                        |
| ------------------------- | ------------------------------------------------------------------------------ |
| `mfa_required`            | The user must complete an MFA challenge before a token can be issued.          |
| `mfa_enrollment_required` | The user has not enrolled any MFA factors. They must enroll before logging in. |
| `mfa_token_invalid`       | The MFA token presented is expired or has already been used.                   |
| `mfa_factor_not_enrolled` | The requested MFA factor is not enrolled for this user.                        |

### Enrollment redirect

When Auth0 returns `mfa_enrollment_required`, it may include an `enrollment_url` in the response. Clients should redirect users to this URL to complete factor enrollment. After enrollment, the user can retry the login flow.

If no `enrollment_url` is available, redirect users to your Auth0 Universal Login page or your organization's MFA enrollment documentation.

## Testing MFA Locally

Auth0 provides a way to test MFA in development without a real device:

1. In the Auth0 Dashboard, go to **Security > Multi-factor Auth**.
2. Enable the **OTP** factor (TOTP).
3. Use an authenticator app to scan the QR code shown during enrollment on your local user account.
4. Log in with your test account and complete the TOTP challenge to obtain a token with `amr: ["mfa"]`.

Alternatively, use Auth0's **Try** button on the application settings page to simulate a login and inspect the resulting token payload in the Auth0 logs.
