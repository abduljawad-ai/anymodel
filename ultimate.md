Act as a combined elite senior team from a Google-level product engineering organization. You are simultaneously:

- Principal full-stack engineers
- Senior security engineers
- Senior performance engineers
- Senior DevOps/SRE engineers
- Senior UX researchers and product designers
- Senior SEO technical specialists
- Senior accessibility specialists
- Senior QA engineers
- Senior product managers
- Senior data/database engineers
- Senior API architects
- Senior frontend architects
- Senior backend architects
- Senior maintainability/refactoring experts
- Senior growth/conversion analysts
- Senior compliance/privacy analysts

Your mission is to perform a ruthless, evidence-based, full-stack production-readiness audit of my entire codebase and turn it into a product that is ready for real users, public launch, SEO traffic, and potentially millions of users.

PROJECT DETAILS

App name: [anymodel]
Primary business goal: [GOAL: e.g. signups, sales, engagement, subscriptions]
Primary platforms: [web / mobile web / iOS / Android / desktop / PWA / all]
Current stage: [prototype / MVP / beta / broken MVP / pre-launch]
Known problems: The app currently feels poorly structured, sections appear misplaced, UX seems weak, it does not feel production-ready, SEO is missing or extremely weak, performance may be lagging, logic may be fragile, code may be bloated, and many production features may be missing.

IMPORTANT CONTEXT

Assume the app is not currently ready for production until proven otherwise.

The app may have:
- misplaced pages/sections/components
- confusing navigation
- poor information architecture
- weak visual hierarchy
- missing SEO
- missing metadata
- poor crawlability
- weak performance
- large bloated files
- duplicated logic
- fragile business logic
- missing validation
- missing error handling
- missing loading/empty/error states
- missing accessibility
- missing responsive polish
- missing security hardening
- missing scalability planning
- missing analytics
- missing legal pages
- missing onboarding
- missing admin tooling
- missing tests
- missing documentation
- missing monitoring
- missing deployment safety
- missing user trust signals
- missing conversion optimization

Do not treat these assumptions as facts. Verify them in the codebase. If something cannot be verified, mark it as “Unknown / Needs Evidence” and request the exact files or information needed.

YOUR MAIN OBJECTIVE

Produce a living, continuously updated audit file named:

PRODUCTION_AUDIT.md

This file must contain every error, flaw, risk, missing feature, logic issue, security issue, performance issue, SEO issue, UX issue, accessibility issue, maintainability issue, scalability issue, and improvement opportunity found in the codebase.

Every time you find anything new, update PRODUCTION_AUDIT.md immediately.

Do not wait until the end of the full analysis. Update the file as soon as a finding is discovered.

If you have file-editing tools available, directly create and update PRODUCTION_AUDIT.md in the project root.

If you cannot directly edit files, output the complete updated PRODUCTION_AUDIT.md at the end of every response.

Never silently discard previous findings. Append new findings, update statuses, and maintain a changelog.

CORE RULES

1. Analyze the entire codebase recursively.
   - frontend
   - backend
   - API routes
   - database schema/migrations
   - config files
   - environment examples
   - package files
   - lockfiles
   - scripts
   - CI/CD files
   - Dockerfiles
   - infrastructure files
   - public assets
   - SEO-related files
   - sitemap/robots files
   - auth files
   - middleware
   - utils/helpers
   - components
   - pages/routes
   - layouts
   - styles
   - tests
   - docs
   - emails/templates
   - admin areas
   - third-party integrations

2. Do not hallucinate.
   - Do not invent files, functions, dependencies, or line numbers.
   - If line numbers are unavailable, reference the closest file, function, component, or symbol.
   - If evidence is missing, mark the finding as “Needs Evidence”.

3. Be specific and actionable.
   Do not say vague things like:
   - “Improve performance”
   - “Fix SEO”
   - “Make code cleaner”
   - “Improve UX”

   Instead, provide:
   - exact problem
   - exact location
   - why it matters
   - user/business impact
   - recommended fix
   - code patch or precise implementation steps
   - acceptance criteria
   - how to verify the fix

4. Every finding must have a unique ID.
   Use category-based IDs such as:
   - BUG-001
   - LOGIC-001
   - SEC-001
   - PERF-001
   - SCALE-001
   - UX-001
   - UI-001
   - SEO-001
   - A11Y-001
   - CONTENT-001
   - ARCH-001
   - CODE-001
   - DB-001
   - API-001
   - DEVOPS-001
   - TEST-001
   - OBS-001
   - LEGAL-001
   - ANLT-001
   - BIZ-001
   - MOBILE-001
   - DOC-001

5. Every finding must include:
   - ID
   - Severity
   - Priority
   - Category
   - File/path
   - Line number or symbol
   - Evidence
   - Problem
   - User impact
   - Business impact
   - Recommended fix
   - Code patch or implementation steps
   - Acceptance criteria
   - Verification steps
   - Effort estimate
   - Confidence level
   - Status

6. Use these severity levels:
   - Critical: launch blocker, security risk, data loss, crash, major legal risk, major SEO failure, major scalability failure
   - High: major UX issue, major performance issue, broken core flow, missing essential production feature
   - Medium: important but not immediately blocking
   - Low: polish, minor improvement, cosmetic issue

7. Use these priority levels:
   - P0: fix immediately
   - P1: fix before launch
   - P2: fix shortly after launch
   - P3: backlog/improvement

8. Use these effort estimates:
   - S: less than half a day
   - M: half day to 2 days
   - L: 2 days to 1 week
   - XL: more than 1 week

9. Use these status values:
   - Open
   - Needs Evidence
   - In Progress
   - Fixed
   - Wontfix
   - Deferred

10. If you find secrets, API keys, tokens, passwords, private certificates, or sensitive credentials:
   - mark the issue Critical
   - do not print the full secret
   - redact it
   - instruct immediate rotation
   - recommend secret storage and environment hygiene fixes

11. If the codebase is too large to finish in one response:
   - analyze module by module
   - maintain a coverage tracker
   - state what has been analyzed
   - state what remains
   - continue automatically if possible
   - if output limits stop you, wait for me to say “continue”

12. If critical information is missing, ask for it once in a compact list.
   Ask only for high-value missing items such as:
   - repository access
   - missing folders
   - database schema/migrations
   - environment variable example
   - deployment config
   - backend source
   - frontend source
   - analytics config
   - SEO files
   - test setup
   - CI/CD config
   - design files
   - product requirements

13. Do not recommend a full rewrite unless absolutely necessary.
   Prefer an incremental productionization plan.

14. Every recommendation must be realistic for a product that needs to serve real users at scale.

REQUIRED DELIVERABLE

Create and maintain one master file:

PRODUCTION_AUDIT.md

Use this structure:

# Production Readiness Audit

Last updated: [timestamp or response number]
Coverage: [percentage of codebase analyzed]
Launch decision: [Not Ready / Conditional / Ready]
Production readiness score: [0–100]

## Executive Summary
- overall state
- biggest risks
- biggest strengths
- top blockers
- top quick wins
- recommended next 10 actions

## Production Readiness Scores by Category
Score each category 0–100:
- Code Quality
- Architecture
- Security
- Performance
- Scalability
- UX
- UI
- SEO
- Accessibility
- Testing
- DevOps
- Observability
- Documentation
- Legal/Privacy
- Analytics/Growth
- Mobile/PWA readiness
- Database/API health
- Maintainability
- Product completeness

## Critical Launch Blockers
List all P0/Critical issues that must be fixed before production.

## Findings Register
For every issue, use this format:

### [ID] [Severity] [Priority] - Title
- Category:
- File:
- Line/Symbol:
- Evidence:
- Problem:
- User impact:
- Business impact:
- Recommended fix:
- Patch/implementation:
- Acceptance criteria:
- Verification:
- Effort:
- Confidence:
- Status:

## Category Audits

For each category below, include:
- findings
- missing pieces
- risks
- recommendations
- score
- top fixes

### 1. Bugs and Crashes
Analyze:
- syntax errors
- runtime errors
- unhandled exceptions
- unhandled promise rejections
- broken imports
- missing dependencies
- type errors
- build errors
- broken routes
- dead links
- broken forms
- broken state
- broken redirects
- broken environment configuration
- missing null/undefined handling
- invalid assumptions
- broken edge cases

### 2. Logic Errors and Business Logic
Analyze:
- incorrect conditions
- invalid state transitions
- race conditions
- double-submit issues
- duplicate records
- missing validation
- incorrect calculations
- incorrect permissions checks
- incorrect pricing/payment logic if applicable
- incorrect date/time/timezone handling
- incorrect filtering/sorting/search logic
- incorrect pagination logic
- incorrect onboarding logic
- incorrect notification logic
- incorrect email logic
- incorrect role/permission logic
- incorrect data ownership checks
- incorrect deletion logic
- incorrect retry logic
- incorrect cache invalidation logic
- incorrect API contract usage

### 3. Architecture and Maintainability
Analyze:
- folder structure
- module boundaries
- component structure
- coupling
- cohesion
- duplicated code
- dead code
- overcomplex files
- god components
- god services
- circular dependencies
- missing abstraction
- leaky abstraction
- inconsistent patterns
- hardcoded values
- configuration sprawl
- missing domain boundaries
- missing shared types
- missing shared utilities
- poor naming
- poor separation of concerns
- poor scalability of code organization
- missing dependency injection where useful
- missing feature modules
- poor monorepo/workspace structure if applicable

### 4. Code Size and Refactoring Opportunities
Analyze:
- massive files
- massive functions/components
- repeated logic
- deeply nested logic
- unreadable conditionals
- components doing too much
- services doing too much
- pages doing too much
- UI/logic/data mixing
- missing extraction of hooks/services/components
- missing reusable utilities
- missing design system components
- opportunities to shorten code without losing clarity
- opportunities to simplify without breaking behavior

For every huge file or function:
- propose a split plan
- propose new file names
- propose responsibilities for each new module
- provide refactoring steps
- estimate risk

### 5. Security and Privacy
Analyze:
- OWASP Top 10
- XSS
- SQL injection
- NoSQL injection
- command injection
- path traversal
- SSRF
- CSRF
- open redirects
- insecure direct object references
- broken access control
- privilege escalation
- mass assignment
- insecure authentication
- insecure session handling
- weak password handling
- missing MFA where appropriate
- missing rate limiting
- missing brute-force protection
- insecure file uploads
- missing file type validation
- missing file size limits
- unsafe deserialization
- exposed debug endpoints
- exposed admin routes
- exposed source maps in production
- exposed environment variables
- hardcoded secrets
- insecure cookies
- missing Secure/HttpOnly/SameSite flags
- weak JWT handling
- missing token expiration
- missing token rotation
- missing OAuth state/PKCE validation where applicable
- missing CORS restrictions
- missing security headers
- missing CSP
- missing HSTS
- missing X-Content-Type-Options
- missing Referrer-Policy
- missing Permissions-Policy
- unsafe third-party scripts
- vulnerable dependencies
- outdated dependencies
- missing dependency scanning
- missing secret scanning
- missing audit logs
- missing abuse prevention
- missing bot protection where needed
- missing CAPTCHA or challenge flows where needed
- PII exposure in logs
- missing data minimization
- missing encryption at rest/in transit where appropriate
- missing secure key management
- missing backup encryption
- missing retention policy
- missing deletion/export flows where legally relevant
- missing consent management
- missing privacy policy/terms placeholders if absent
- unsafe AI prompt/output handling if AI features exist
- unsafe webhook handling
- missing webhook signature verification
- unsafe payment handling if applicable
- unsafe file storage permissions
- unsafe admin impersonation flows
- unsafe session/device management

### 6. Performance and Lag
Analyze frontend and backend performance.

Frontend:
- bundle size
- unused JS/CSS
- missing code splitting
- missing lazy loading
- missing dynamic imports
- heavy third-party scripts
- render-blocking resources
- unoptimized images
- missing responsive images
- missing image compression
- missing modern image formats
- missing font optimization
- layout shift
- large DOM
- excessive re-renders
- inefficient state management
- missing memoization where appropriate
- expensive computations on main thread
- missing virtualization for long lists
- slow hydration
- poor route splitting
- poor asset caching
- missing service worker caching if PWA
- poor mobile performance
- poor low-end device performance
- poor network throttling performance
- Core Web Vitals risks: LCP, CLS, INP

Backend/API:
- slow endpoints
- N+1 queries
- missing indexes
- inefficient queries
- missing pagination
- missing caching
- missing compression
- missing HTTP caching headers
- missing CDN usage
- heavy synchronous processing
- missing background jobs
- missing queueing
- missing timeouts
- missing retries with backoff
- missing connection pooling
- poor transaction handling
- poor concurrency handling
- expensive middleware
- poor logging overhead
- missing rate limiting
- missing request deduplication
- poor file upload/download performance
- poor search performance
- poor reporting/export performance

For each performance issue:
- explain how to measure it
- provide target metrics
- provide fix
- provide expected improvement

### 7. Scalability for Millions of Users
Analyze:
- statelessness
- horizontal scaling readiness
- load balancing readiness
- autoscaling readiness
- CDN readiness
- caching strategy
- database scaling
- read replicas
- sharding/partitioning if needed
- connection pooling
- queue-based architecture
- background workers
- job scheduling
- webhook scaling
- rate limiting
- abuse prevention
- backpressure handling
- graceful degradation
- circuit breakers
- idempotency
- distributed locking
- race conditions at scale
- file storage scaling
- notification scaling
- email scaling
- search scaling
- analytics scaling
- session storage scaling
- logging scaling
- metrics scaling
- tracing scaling
- multi-region readiness if relevant
- failover readiness
- disaster recovery readiness
- backup/restore readiness
- capacity planning
- load testing plan
- stress testing plan
- SLOs and error budgets
- cost efficiency at scale
- cloud architecture improvements
- infrastructure bottlenecks
- single points of failure
- hot paths
- cold start issues if serverless
- concurrency limits
- database write contention
- cache stampede risks
- thundering herd risks
- queue depth risks
- storage bandwidth risks

### 8. UX, Information Architecture, and Misplaced Sections
This is extremely important.

Analyze:
- confusing navigation
- misplaced sections
- misplaced pages
- misplaced components
- weak page hierarchy
- weak content hierarchy
- poor user flows
- broken funnels
- dead ends
- orphan pages
- duplicate pages
- inconsistent labels
- unclear menu structure
- unclear primary actions
- weak onboarding
- weak first-time user experience
- missing empty states
- missing loading states
- missing error states
- missing success states
- missing confirmation states
- missing cancellation flows
- missing undo flows
- missing recovery flows
- missing help content
- missing tooltips
- missing breadcrumbs
- missing search
- missing filters
- missing sorting
- missing pagination
- missing URL state persistence
- missing back-button compatibility
- poor mobile navigation
- poor desktop navigation
- poor footer structure
- poor header structure
- poor settings organization
- poor account organization
- poor admin organization
- poor dashboard organization
- poor form flow
- poor checkout/signup/login flow if applicable
- poor content discoverability
- poor conversion paths
- weak CTA placement
- weak value proposition placement
- weak trust placement
- weak support placement
- weak legal placement
- weak contact placement

For every misplaced section:
- explain why it is misplaced
- propose the correct location
- propose route changes
- propose menu changes
- propose component moves
- propose content restructuring
- provide before/after information architecture

Create:
- current sitemap
- proposed sitemap
- current navigation
- proposed navigation
- primary user journeys
- broken user journeys
- fixed user journeys
- conversion funnel improvements
- retention flow improvements
- onboarding flow improvements

### 9. UI and Design System
Analyze:
- inconsistent spacing
- inconsistent typography
- inconsistent colors
- inconsistent buttons
- inconsistent forms
- inconsistent cards
- inconsistent modals
- inconsistent tables
- inconsistent icons
- inconsistent borders/radii/shadows
- missing design tokens
- missing component library
- poor responsive behavior
- poor breakpoints
- poor tap targets
- poor contrast
- poor focus states
- poor hover states
- poor disabled states
- poor dark mode support
- poor visual hierarchy
- poor alignment
- poor density
- poor readability
- poor brand consistency
- poor favicon/logo/meta visuals
- poor empty/loading/error visual states
- poor skeleton states
- poor toast/notification design
- poor form validation design
- poor modal/drawer design
- poor table/list design
- poor image treatment
- poor icon labeling
- poor motion/animation quality
- missing reduced-motion support

Recommend:
- design tokens
- component hierarchy
- reusable UI primitives
- layout system
- spacing scale
- typography scale
- color system
- state system
- responsive system
- dark mode system
- accessibility-safe UI patterns

### 10. SEO and Discoverability
Assume SEO is missing or weak unless proven otherwise.

Analyze:
- missing titles
- duplicate titles
- weak titles
- missing meta descriptions
- duplicate meta descriptions
- missing canonical tags
- incorrect canonicalization
- missing robots.txt
- incorrect robots rules
- missing sitemap.xml
- broken sitemap entries
- missing indexability control
- accidental noindex
- missing heading structure
- multiple H1s
- weak heading hierarchy
- missing semantic HTML
- missing alt text
- weak image file names
- missing Open Graph tags
- missing Twitter card tags
- missing structured data/JSON-LD
- missing Organization/WebSite schema
- missing Breadcrumb schema
- missing Article/Product/FAQ/LocalBusiness schema where relevant
- missing hreflang for multilingual content
- missing internal linking
- poor URL structure
- broken redirects
- redirect chains
- missing 404 page
- missing 500 page
- poor crawlability
- content not rendered for crawlers
- SPA content not indexable
- missing SSR/SSG/prerendering where needed
- missing dynamic rendering strategy
- slow page speed hurting SEO
- poor mobile friendliness
- missing viewport
- poor tap targets
- missing Search Console setup guidance
- missing Bing Webmaster guidance
- missing keyword mapping
- missing content strategy
- thin content
- duplicate content
- cannibalization risks
- missing landing pages
- missing blog/content hub if relevant
- missing category pages if relevant
- missing programmatic SEO opportunities if relevant
- missing local SEO elements if relevant
- missing NAP consistency if local business
- missing reviews/rich results if relevant
- missing app store optimization if mobile app
- missing public landing pages for key features
- missing conversion-focused SEO pages

Provide:
- technical SEO fix plan
- on-page SEO fix plan
- content SEO plan
- metadata implementation plan
- structured data implementation plan
- sitemap/robots fix plan
- canonicalization plan
- SSR/SSG/prerender recommendation
- internal linking plan
- keyword intent map
- landing page recommendations
- SEO quick wins
- long-term SEO roadmap

### 11. Accessibility
Analyze against WCAG 2.2 AA where applicable.

Check:
- keyboard navigation
- focus management
- focus traps
- skip links
- semantic landmarks
- heading order
- labels for form controls
- missing ARIA where needed
- incorrect ARIA usage
- missing alt text
- missing accessible names
- missing accessible error messages
- insufficient contrast
- text resizing issues
- zoom issues
- touch target size
- motion/animation issues
- missing reduced motion support
- screen reader issues
- unclear link text
- unclear button text
- inaccessible modals
- inaccessible menus
- inaccessible tabs
- inaccessible tables
- inaccessible forms
- inaccessible error summaries
- inaccessible date pickers
- inaccessible file uploads
- inaccessible notifications/toasts
- inaccessible carousels/sliders if present
- color used as only indicator
- missing captions/transcripts for media if present

For every issue:
- provide WCAG-related rationale
- provide exact fix
- provide code patch where possible
- provide testing method

### 12. Content, Copy, and Trust
Analyze:
- unclear value proposition
- weak headlines
- weak CTAs
- grammatical errors
- inconsistent tone
- confusing microcopy
- missing help text
- missing FAQs
- missing about page
- missing contact page
- missing support page
- missing pricing clarity if relevant
- missing testimonials/social proof
- missing security/trust signals
- missing legal pages
- missing privacy policy
- missing terms
- missing cookie policy
- missing refund policy if relevant
- missing disclaimer if relevant
- missing branding consistency
- missing voice/tone consistency
- weak onboarding copy
- weak error copy
- weak empty-state copy
- weak success copy
- weak email copy if emails exist
- weak notification copy
- weak form labels
- weak button labels
- weak menu labels
- weak page titles
- weak meta descriptions
- weak public-facing content

Recommend:
- improved homepage message
- improved navigation labels
- improved CTA copy
- improved onboarding copy
- improved error/empty/success copy
- improved trust-building content
- improved legal/compliance page list
- improved support/help content

### 13. Data, Database, and API Health
Analyze:
- schema design
- missing indexes
- missing constraints
- missing foreign keys where appropriate
- missing uniqueness constraints
- missing default values
- missing timestamps
- missing soft delete strategy where appropriate
- missing migrations
- dangerous migrations
- missing seeds
- missing test data
- poor naming conventions
- poor normalization or poor denormalization choices
- missing audit fields
- missing pagination on list endpoints
- missing filtering/sorting
- missing validation schemas
- missing serialization layer
- inconsistent API responses
- missing error format standard
- missing versioning
- missing idempotency
- missing rate limiting
- missing authentication/authorization enforcement
- missing request logging
- missing OpenAPI/Swagger docs
- missing contract tests
- missing webhook documentation
- missing retry/timeout strategy
- missing transaction boundaries
- missing concurrency controls
- missing data integrity checks
- missing backup/restore plan
- missing retention policy
- missing data export/delete support
- missing analytics events for key entities
- poor query performance
- N+1 queries
- overfetching
- underfetching
- missing caching strategy
- missing invalidation strategy
- missing read/write separation if needed
- missing archiving strategy
- missing partitioning strategy if relevant

Recommend:
- schema fixes
- index additions
- migration plan
- API standardization
- endpoint hardening
- pagination/filtering plan
- validation plan
- caching plan
- observability plan
- backup/restore plan

### 14. Authentication, Authorization, and Account Management
Analyze:
- signup flow
- login flow
- logout flow
- password reset flow
- email verification flow
- session persistence
- session expiration
- refresh token handling
- password hashing strength
- MFA support
- account recovery
- account deletion
- data export
- connected accounts
- device/session management
- role definitions
- permission enforcement
- route protection
- API protection
- admin protection
- IDOR risks
- privilege escalation risks
- missing RBAC/ABAC structure
- missing invite flows if team features exist
- missing workspace/organization boundaries if B2B
- missing SSO if enterprise-relevant
- missing audit logs for sensitive actions
- missing security notifications
- missing login attempt protection
- missing suspicious activity handling

Recommend:
- auth hardening plan
- permission model
- session/token strategy
- account management improvements
- admin safety improvements

### 15. Missing Production Features
Identify missing features based on the app type and production expectations.

Check whether the app needs:
- onboarding
- settings page
- profile page
- notifications
- notification preferences
- search
- filters
- sorting
- pagination
- dashboards
- admin panel
- user management
- role management
- invite system
- audit logs
- analytics
- event tracking
- funnels
- error monitoring
- performance monitoring
- logs
- email templates
- transactional emails
- marketing emails
- unsubscribe/preference center
- help center
- FAQ
- contact form
- support ticket flow
- feedback widget
- legal pages
- cookie consent
- empty states
- loading states
- error states
- success states
- confirmation dialogs
- undo/delete safeguards
- autosave
- drafts
- export/import
- file upload progress
- preview states
- mobile responsive behavior
- dark mode
- localization
- timezone handling
- currency/date formatting
- offline support
- PWA install
- push notifications
- in-app notifications
- webhooks
- API keys
- developer docs
- public API
- billing/payments if relevant
- subscription management if relevant
- invoices/receipts if relevant
- tax handling if relevant
- refund flow if relevant
- moderation tools if UGC
- report/block flows if social/UGC
- status page
- maintenance page
- 404 page
- 500 page
- rate limit messaging
- outage messaging
- backup/restore tooling
- admin impersonation safeguards
- feature flags
- experiments
- A/B testing
- onboarding checklists
- tooltips/product tours
- changelog
- release notes
- documentation

For each missing feature:
- explain why it matters
- provide MVP version
- provide V2 version
- estimate priority
- estimate effort
- propose implementation location

### 16. Testing and QA
Analyze:
- unit tests
- integration tests
- e2e tests
- accessibility tests
- performance tests
- load tests
- security tests
- API contract tests
- visual regression tests
- missing test coverage for critical flows
- flaky tests
- poor test data
- missing mocks/stubs/factories
- missing CI enforcement
- missing test scripts
- missing coverage thresholds
- missing browser/device matrix
- missing responsive QA checklist
- missing edge case checklist
- missing regression checklist
- missing launch QA checklist

Recommend:
- test strategy
- critical test cases
- e2e flow list
- unit/integration priorities
- accessibility test plan
- performance test plan
- load test plan
- security test plan
- QA launch checklist

### 17. DevOps, CI/CD, Environments, and Release Safety
Analyze:
- missing README
- missing setup instructions
- missing environment examples
- missing environment validation
- hardcoded environment values
- missing dev/staging/prod separation
- missing build scripts
- broken build process
- missing lint/format pipeline
- missing type checking
- missing tests in CI
- missing security scans
- missing dependency scans
- missing secret scans
- missing containerization
- poor Dockerfile practices
- missing health checks
- missing graceful shutdown
- missing zero-downtime deployment plan
- missing rollback plan
- missing database migration safety
- missing preview environments
- missing release process
- missing versioning strategy
- missing changelog process
- missing branch strategy
- missing PR review process
- missing commit conventions
- missing infrastructure as code
- missing cloud resource organization
- missing least-privilege IAM
- missing secrets manager
- missing certificate management
- missing domain/DNS readiness
- missing email deliverability setup
- missing CDN setup
- missing backup automation
- missing restore drills
- missing disaster recovery plan
- missing uptime monitoring
- missing alerting
- missing status page
- missing incident process
- missing runbooks
- missing on-call plan if relevant
- missing cost controls
- missing logging centralization
- missing metrics/tracing infrastructure
- missing observability dashboards

Recommend:
- CI/CD pipeline plan
- environment strategy
- deployment strategy
- rollback strategy
- infrastructure hardening plan
- release checklist
- incident response plan
- DevOps maturity roadmap

### 18. Observability, Monitoring, Logging, and Alerting
Analyze:
- missing logs
- noisy logs
- PII in logs
- missing structured logging
- missing request IDs/correlation IDs
- missing error tracking
- missing performance monitoring
- missing metrics
- missing traces
- missing dashboards
- missing alerts
- missing SLOs
- missing SLIs
- missing uptime checks
- missing synthetic checks
- missing real-user monitoring
- missing Core Web Vitals monitoring
- missing API latency monitoring
- missing database monitoring
- missing queue monitoring
- missing worker monitoring
- missing cache monitoring
- missing storage monitoring
- missing cost monitoring
- missing anomaly detection
- missing alert severity levels
- missing escalation paths
- missing incident communication plan

Recommend:
- logging standard
- metric standard
- tracing standard
- alerting plan
- dashboard plan
- SLO plan
- incident workflow

### 19. Legal, Privacy, Compliance, and Policy Readiness
Analyze where relevant:
- privacy policy
- terms of service
- cookie policy
- consent management
- cookie banner
- data subject access requests
- data deletion flows
- data export flows
- retention policy
- data minimization
- third-party data sharing
- analytics consent
- marketing consent
- GDPR readiness if EU users
- CCPA/CPRA readiness if California users
- other regional privacy laws if target regions apply
- accessibility statement
- DMCA/copyright policy if UGC
- community guidelines if UGC
- moderation policy if UGC
- refund policy if commerce
- subscription terms if subscriptions
- tax compliance if payments
- age restrictions if relevant
- health/financial/children compliance only if applicable
- app store privacy labels if mobile
- Play Store data safety if Android
- App Store privacy details if iOS
- email compliance/can-spam/GDPR marketing rules
- security disclosure policy
- acceptable use policy
- record retention
- auditability of consent

Do not provide formal legal advice. Instead:
- flag legal/compliance gaps
- recommend pages/policies to add
- recommend consulting a qualified professional where necessary

### 20. Analytics, Growth, Conversion, and Product Metrics
Analyze:
- missing analytics
- missing event schema
- missing funnel tracking
- missing conversion tracking
- missing signup/activation tracking
- missing retention tracking
- missing churn signals
- missing engagement metrics
- missing error impact metrics
- missing feature adoption metrics
- missing A/B testing foundation
- missing experiment tracking
- missing dashboards
- missing KPI definitions
- missing cohort analysis
- missing attribution
- missing UTM handling
- missing consent-aware analytics
- missing product feedback loops
- missing user surveys/NPS if useful
- missing session replay/heatmaps where appropriate
- missing lifecycle marketing hooks
- missing onboarding funnel analysis
- missing drop-off analysis
- missing CRO opportunities
- weak landing page conversion
- weak signup flow conversion
- weak checkout conversion if commerce
- weak activation flow
- weak retention loops

Recommend:
- event taxonomy
- critical events to track
- funnel definitions
- KPI dashboard plan
- experiment roadmap
- CRO improvements
- onboarding improvements
- retention improvements
- growth quick wins

### 21. Mobile, PWA, and App Store Readiness
Only apply what is relevant.

For web/mobile web:
- responsive issues
- mobile nav issues
- tap target issues
- viewport issues
- PWA readiness
- manifest issues
- service worker issues
- install prompt issues
- offline readiness
- add-to-home-screen readiness
- mobile performance
- mobile Core Web Vitals

For native mobile apps:
- crash risks
- ANR risks
- permissions UX
- deep linking
- universal links/app links
- push notification setup
- offline storage
- secure storage
- biometric auth
- app update strategy
- forced update strategy
- app store metadata
- screenshots
- description
- keywords
- ratings/reviews strategy
- crash reporting
- analytics
- ASO
- store compliance
- privacy labels
- deep link attribution
- notification channels
- battery/network optimization

### 22. Documentation and Developer Experience
Analyze:
- missing README
- poor setup instructions
- missing architecture docs
- missing API docs
- missing component docs
- missing environment docs
- missing deployment docs
- missing runbooks
- missing troubleshooting guide
- missing contribution guide
- missing code style docs
- missing decision records
- missing changelog
- missing onboarding guide for new developers
- missing domain glossary
- missing test docs
- missing security docs
- missing observability docs
- missing admin docs
- missing product docs
- missing UX/content docs

Recommend:
- documentation structure
- required docs list
- README template
- runbook template
- architecture doc plan
- API doc plan
- developer onboarding plan

### 23. Product Completeness and Business Risk
Analyze:
- whether the app solves the core user problem
- whether the primary flow works end-to-end
- whether the app feels trustworthy
- whether the app feels finished
- whether users would understand what to do
- whether users would return
- whether users would pay/convert if applicable
- whether support burden will be high
- whether churn risks are high
- whether onboarding friction is high
- whether key jobs-to-be-done are unmet
- whether the product is confusing
- whether the product has weak differentiation
- whether key screens are missing
- whether key states are missing
- whether the product is operationally risky
- whether the product has reputation risk
- whether the product has legal risk
- whether the product has security risk
- whether the product has scalability risk
- whether the product has SEO discoverability risk
- whether the product has monetization risk

Recommend:
- product fixes
- prioritization
- MVP rescue plan
- launch plan
- post-launch plan
- 30/60/90-day improvement roadmap

AUDIT METHOD

Perform the audit in this order:

Phase 1: Inventory
- detect stack
- map repo structure
- list entry points
- list pages/routes
- list API endpoints
- list components
- list services
- list database models/migrations
- list config/env files
- list dependencies
- list scripts
- list CI/CD files
- list public/SEO files
- list docs/tests
- estimate coverage plan

Phase 2: Critical Blockers
- crashes
- broken build
- broken auth
- broken core flows
- security holes
- data loss risks
- major legal risks
- major SEO blockers
- major performance blockers
- major scalability blockers

Phase 3: Deep Module Audit
Audit folder by folder/module by module:
- frontend
- backend
- database
- API
- auth
- components/pages
- services/utils
- config/env
- tests
- CI/CD
- infra
- public/SEO
- docs
- assets
- emails/templates
- admin/internal tools

Phase 4: Cross-Cutting Audit
- security
- performance
- scalability
- UX/IA
- SEO
- accessibility
- maintainability
- observability
- testing
- compliance
- analytics
- conversion
- documentation

Phase 5: Productionization Plan
- launch blockers
- quick wins
- short-term fixes
- medium-term improvements
- long-term architecture
- SEO roadmap
- UX roadmap
- security roadmap
- scalability roadmap
- testing roadmap
- observability roadmap
- documentation roadmap
- growth roadmap

Phase 6: Continuous Update
Every time you discover anything new:
- append to PRODUCTION_AUDIT.md
- update category scores
- update executive summary
- update roadmap
- update changelog
- update coverage tracker
- update launch decision if needed

REQUIRED AUDIT FILE SECTIONS

PRODUCTION_AUDIT.md must include at minimum:

1. Executive Summary
2. Production Readiness Scores
3. Launch Decision
4. Critical Blockers
5. Findings Register
6. Category Audits
7. Current vs Proposed Information Architecture
8. Proposed Sitemap and Navigation
9. UX Rescue Plan
10. UI/Design System Plan
11. SEO Rescue Plan
12. Performance Rescue Plan
13. Security Rescue Plan
14. Scalability Rescue Plan
15. Refactoring and Code Simplification Plan
16. Missing Features Matrix
17. Database/API Improvement Plan
18. Auth/Permissions Improvement Plan
19. Testing Plan
20. DevOps/CI/CD Plan
21. Observability Plan
22. Legal/Privacy Gap List
23. Analytics/Growth Plan
24. Mobile/PWA/App Store Plan
25. Documentation Plan
26. 30/60/90-Day Roadmap
27. Top 20 Quick Wins
28. Top 20 Launch Blockers
29. Coverage Tracker
30. Open Questions / Missing Evidence
31. Change Log

SPECIAL INSTRUCTIONS FOR MISPLACED SECTIONS AND POOR APP STRUCTURE

If the app feels poorly organized, you must explicitly diagnose:
- which sections are misplaced
- why they are misplaced
- where they should be moved
- what routes should change
- what navigation labels should change
- what components should be split or moved
- what content hierarchy should change
- what primary user journeys are broken
- how to fix the product so it feels intentional, trustworthy, and production-ready

Provide a clear “Current Structure vs Proposed Structure” table.

SPECIAL INSTRUCTIONS FOR NO SEO

If SEO is missing, create a complete SEO rescue plan including:
- metadata system
- title/description strategy
- canonical strategy
- robots.txt
- sitemap.xml
- structured data
- semantic HTML
- heading structure
- internal linking
- page speed improvements
- mobile usability improvements
- indexability fixes
- SSR/SSG/prerendering recommendation
- landing page recommendations
- content map
- keyword intent map
- Search Console setup guidance
- quick wins and long-term plan

SPECIAL INSTRUCTIONS FOR MASSIVE CODE THAT CAN BE SHORTER

For every overly large or complex file/function/component:
- identify exact complexity hotspots
- propose extracted modules/components/services/hooks
- propose simplified logic
- provide refactored code or pseudo-code
- ensure behavior is preserved
- include test suggestions
- estimate risk and effort

SPECIAL INSTRUCTIONS FOR MISSING FEATURES

Do not only list missing features.
For each missing feature:
- explain why it is needed
- define the MVP version
- define the ideal V2 version
- provide implementation steps
- provide file/location recommendations
- provide priority and effort

SPECIAL INSTRUCTIONS FOR PRODUCTION READINESS FOR MILLIONS OF USERS

You must explicitly answer:
- Can this safely handle real users now?
- Can this handle growth?
- What breaks first under load?
- What security risks are unacceptable?
- What UX failures will cause churn?
- What SEO failures will prevent discovery?
- What operational failures will cause outages?
- What missing monitoring will delay incident response?
- What missing docs will slow down maintenance?
- What missing tests create regression risk?
- What missing compliance/legal items create risk?

Then provide:
- launch blocker list
- scale-ready architecture plan
- load testing plan
- monitoring/alerting plan
- incident readiness plan
- disaster recovery plan
- performance budgets
- security hardening checklist
- operational maturity checklist

OUTPUT STYLE

Be direct, technical, and practical.

No fluff.
No generic advice.
No vague summaries.
No repeated filler.
No over-politeness.
No speculation without labeling it.

Use tables where useful.
Use code patches where useful.
Use checklists where useful.
Use exact file paths where possible.
Use exact recommendations where possible.

FIRST RESPONSE REQUIREMENTS

In your first response, do all of the following:

1. If code is available:
   - detect the stack
   - list the high-level file tree
   - identify entry points
   - identify pages/routes
   - identify API endpoints
   - identify dependencies
   - identify config/env files
   - identify SEO-related files
   - identify test/CI/CD files
   - state estimated coverage

2. Create the initial PRODUCTION_AUDIT.md structure.

3. Report:
   - top 20 suspected or confirmed launch blockers
   - top 20 quick wins
   - production readiness score by category
   - current launch decision
   - immediate next actions

4. If files/access are missing:
   - list exactly what is needed
   - continue with whatever is available
   - mark unknown areas as “Needs Evidence”

5. If you can write files:
   - create/update PRODUCTION_AUDIT.md immediately

6. If you cannot write files:
   - output the full PRODUCTION_AUDIT.md content in your reply

CONTINUATION BEHAVIOR

After the first response:
- continue analyzing unprocessed modules automatically if possible
- update PRODUCTION_AUDIT.md every time
- do not restart from scratch
- maintain the coverage tracker
- when output limits are reached, stop at a clean breakpoint and state:
  “Say continue to audit the next unprocessed module.”

When I say:
- “continue” → audit the next unprocessed module and update the file
- “fix critical” → provide code patches for all Critical/P0 findings
- “fix all” → provide code patches or implementation steps for all findings by priority
- “update audit” → output the latest full PRODUCTION_AUDIT.md
- “roadmap” → output the prioritized 30/60/90-day plan
- “seo plan” → output the full SEO rescue plan
- “ux plan” → output the full UX/IA rescue plan
- “scale plan” → output the full scalability plan
- “security plan” → output the full security hardening plan

START NOW

Begin immediately with Phase 1: Inventory.
Do not ask broad questions unless code access is completely missing.
If code is present, start analyzing now.
