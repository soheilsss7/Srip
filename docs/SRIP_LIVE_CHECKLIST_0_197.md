# SRIP — Live Granular Checklist 0–197

> وضعیت این فایل بر اساس کد موجود در Repository در همین Build است. `[x]` فقط برای قابلیت‌هایی است که کد/مدل/مسیر اجرایی آن‌ها در پروژه اضافه شده؛ موارد صرفاً طراحی‌شده یا وابسته به سرویس خارجی تیک نخورده‌اند.

This file preserves every checkbox item extracted from the original technical checklist. `[x]` means implemented in the current repository; `[ ]` means pending. No unchecked item is assumed production-ready.

## بخش 0 — تصمیم معماری نهایی
- [x] محصول به صورت Web Application + Mobile Application ساخته شود.
- [ ] Web برای:
- [ ] Mobile برای:
- [x] Web و Mobile باید از یک Backend و یک API مشترک استفاده کنند.
- [x] Business Logic نباید در Mobile یا Web تکرار شود.
## بخش 1 — Technology Stack
- [x] TypeScript
- [x] React
- [x] Next.js با App Router
- [x] استفاده از نسخه Stable/LTS، نه Canary
- [ ] Tailwind CSS
- [ ] shadcn/ui یا یک Design System اختصاصی مبتنی بر آن
- [ ] TanStack Query برای Server State در بخش‌هایی که نیاز است
- [ ] Zod برای Validation
- [ ] React Hook Form برای فرم‌های پیچیده
- [ ] Recharts یا Apache ECharts برای Analytics
- [ ] React Flow / Cytoscape.js برای Network Graph در صورت مناسب بودن پس از Benchmark
## بخش 2 — Mobile Stack
- [x] React Native
- [x] Expo
- [x] Expo Router
- [x] TypeScript
- [ ] React Native Reanimated
- [ ] NativeWind یا Design System اختصاصی
- [ ] Expo Notifications
- [ ] Expo SecureStore
- [ ] Expo Camera در صورت نیاز
- [ ] Expo Calendar در صورت نیاز
- [ ] Deep Linking
- [ ] Biometric Authentication
- [ ] Push Notification
- [ ] Offline Storage
- [ ] Background Sync در صورت نیاز
## بخش 3 — Backend
- [x] Node.js
- [x] TypeScript
- [x] NestJS
- [x] REST API به عنوان API اصلی
- [x] OpenAPI / Swagger
- [ ] WebSocket برای موارد Real-Time
- [x] Background Jobs
- [ ] Event-driven internal architecture
## بخش 4 — Database
- [x] PostgreSQL
- [x] Users
- [x] Organizations
- [x] Persons
- [x] Relationships
- [x] Interactions
- [x] Meetings
- [x] Actions
- [x] Commitments
- [x] Projects
- [x] Requirements
- [x] Opportunities
- [x] Recommendations
- [x] Documents Metadata
- [x] Notifications
- [x] Audit Logs
- [x] Permissions
- [x] Workflows
- [x] Tags
- [x] Scores
## بخش 5 — Graph Database
- [x] از PostgreSQL به عنوان سیستم اصلی شروع شود.
- [x] Network Graph ابتدا از Relationship Tables ساخته شود.
- [ ] اگر در Benchmark مشخص شد Graph Queryها از PostgreSQL قابل مدیریت نیستند، Neo4j یا Graph Database اختصاصی اضافه شود.
- [x] Graph Database از روز اول الزام نباشد.
- [x] معماری باید به گونه‌ای باشد که اضافه‌کردن Graph DB در آینده ممکن باشد.
## بخش 6 — Cache
- [x] Redis
- [x] Session-related temporary data
- [ ] Rate Limiting
- [ ] Cache
- [x] Queue
- [ ] Distributed locks
- [ ] Background Jobs
- [ ] Temporary AI results
## بخش 7 — Queue / Background Processing
- [x] Redis + BullMQ
- [ ] Email processing
- [x] AI processing
- [ ] Meeting transcription
- [x] Document processing
- [x] Notifications
- [x] Reminder
- [x] Recommendation generation
- [ ] Score recalculation
- [ ] Search indexing
- [x] Data synchronization
## بخش 8 — File Storage
- [ ] Object Storage
- [ ] S3-compatible storage
- [ ] فایل جلسه
- [ ] PDF
- [ ] قرارداد
- [ ] Proposal
- [ ] تصاویر
- [ ] Attachment
- [ ] Meeting Recording در صورت مجاز بودن
- [x] Transcript
- [ ] Export
## بخش 9 — Search
- [x] PostgreSQL Full Text Search
- [ ] OpenSearch / Elasticsearch در صورت نیاز
- [x] Organization
- [x] Person
- [x] Relationship
- [x] Meeting
- [x] Interaction
- [x] Project
- [x] Opportunity
- [x] Document
- [x] Note
## بخش 10 — Authentication
- [x] Login
- [x] Logout
- [x] Password Reset
- [ ] Email Verification
- [ ] MFA
- [ ] TOTP
- [ ] Recovery Codes
- [x] Session Management
- [ ] Device Management
- [x] Login History
- [ ] Suspicious Login Detection
- [ ] Account Lock / Protection
- [x] Password Policy
- [x] Session Revocation
- [x] Global Logout
- [ ] Admin Session Revocation
## بخش 11 — Identity Architecture
- [ ] استفاده از یک Identity Provider معتبر به جای ساخت Authentication از صفر.
- [ ] Auth0
- [ ] Keycloak
- [ ] Microsoft Entra ID برای Enterprise
- [ ] AWS Cognito
- [ ] سرویس Identity اختصاصی فقط در صورت نیاز واقعی
## بخش 12 — Enterprise Authentication
- [ ] Google SSO
- [ ] Microsoft SSO
- [ ] Microsoft Entra ID
- [ ] OIDC
- [ ] OAuth 2.1-compatible flows
- [ ] SAML در صورت نیاز Enterprise
- [ ] SCIM برای Provisioning سازمانی در فاز Enterprise
## بخش 13 — Authorization
## بخش 14 — RBAC
- [ ] Super Admin
- [x] Holding Admin
- [ ] Holding Executive
- [ ] Subsidiary Admin
- [ ] Subsidiary Executive
- [x] Relationship Manager
- [x] Project Manager
- [ ] Analyst
- [x] Standard User
- [ ] Read Only
## بخش 15 — ABAC
- [x] Role
- [x] Organization
- [ ] Subsidiary
- [x] Department
- [x] Data Classification
- [x] Ownership
- [x] Relationship Sensitivity
- [x] User Scope
## بخش 16 — Data Isolation
- [ ] متعلق به Holding
- [ ] متعلق به Subsidiary
- [ ] متعلق به Department
- [ ] Shared
- [ ] Restricted
- [ ] Private
## بخش 17 — Multi-Company Architecture
- [ ] فقط یک شرکت داشته باشد
- [x] به چند شرکت دسترسی داشته باشد.
## بخش 18 — Core Domain Model
- [x] User
- [x] Role
- [x] Permission
- [x] Organization
- [x] OrganizationType
- [x] OrganizationUnit
- [x] Person
- [x] Relationship
- [x] RelationshipType
- [x] Interaction
- [x] InteractionType
- [x] Meeting
- [x] MeetingParticipant
- [x] Action
- [x] Commitment
- [x] Project
- [x] ProjectRequirement
- [x] Opportunity
- [x] Recommendation
- [x] ConnectionPath
- [x] Referral
- [x] Document
- [x] Note
- [x] Tag
- [x] Notification
- [x] Workflow
- [x] WorkflowExecution
- [x] AuditLog
- [x] Score
- [x] ScoreSnapshot
## بخش 19 — Organization Schema
- [x] id
- [x] legal_name
- [x] display_name
- [x] english_name
- [x] organization_type
- [x] industry
- [x] country
- [x] city
- [x] address
- [x] website
- [x] phone
- [x] email
- [x] parent_organization_id
- [x] status
- [x] strategic_importance
- [x] created_at
- [x] updated_at
## بخش 20 — Person Schema
- [x] id
- [x] first_name
- [x] last_name
- [x] display_name
- [x] organization_id
- [x] job_title
- [x] department
- [x] email
- [x] phone
- [x] country
- [x] influence_score
- [x] decision_power
- [x] accessibility_score
- [x] notes
- [x] status
- [x] created_at
- [x] updated_at
## بخش 21 — Relationship Schema
- [x] id
- [x] source_entity
- [x] target_entity
- [x] relationship_type
- [x] status
- [x] owner_id
- [x] backup_owner_id
- [x] strategic_score
- [x] health_score
- [x] trust_score
- [x] influence_score
- [x] access_score
- [x] opportunity_score
- [x] risk_score
- [x] resilience_score
- [x] engagement_score
- [x] last_interaction_at
- [x] next_action_at
- [x] created_at
- [x] updated_at
## بخش 22 — Interaction Schema
- [x] Interaction ID
- [x] Type
- [x] Organization
- [x] Person
- [x] Relationship
- [x] User
- [x] Date
- [x] Duration
- [x] Subject
- [x] Summary
- [x] Outcome
- [x] Sentiment
- [x] Importance
- [x] Attachments
- [x] Follow-up Required
- [x] Follow-up Date
## بخش 23 — Meeting Schema
- [x] Meeting ID
- [x] Title
- [x] Objective
- [x] Organization
- [x] Participants
- [x] Owner
- [x] Start Time
- [x] End Time
- [x] Location
- [x] Online Meeting URL
- [x] Agenda
- [x] Pre-Meeting Brief
- [x] Notes
- [x] Decisions
- [x] Commitments
- [x] Actions
- [x] Outcome
- [x] Transcript
- [x] Recording Reference
## بخش 24 — Action Schema
- [x] Action ID
- [x] Title
- [x] Owner
- [x] Organization
- [x] Person
- [x] Project
- [x] Relationship
- [x] Priority
- [x] Status
- [x] Due Date
- [x] Dependency
- [x] Completion Date
- [x] Outcome
## بخش 25 — Commitment Schema
- [x] Commitment ID
- [x] Source
- [x] Receiver
- [x] Organization
- [x] Person
- [x] Description
- [x] Owner
- [x] Due Date
- [x] Status
- [x] Evidence
- [x] Completion Date
- [x] Risk
## بخش 26 — Project Schema
- [x] Project ID
- [x] Name
- [x] Customer
- [x] Owner
- [x] Status
- [x] Priority
- [x] Start Date
- [x] End Date
- [x] Objective
- [x] Requirements
- [x] Relationships
- [x] Opportunities
- [x] Risks
- [x] Actions
- [x] Milestones
## بخش 27 — Requirement Engine
- [x] Requirement ایجاد شود.
## بخش 28 — Requirement Matching
- [x] Direct Connections
- [x] Indirect Connections
- [x] Internal Connections
- [x] External Connections
- [x] Recommended Connectors
- [x] Connection Strength
- [x] Success Probability
## بخش 29 — Connection Path Engine
- [x] Direct Path
- [x] 1-Hop Path
- [x] 2-Hop Path
- [x] Multi-Hop Path
- [x] Best Connector
- [x] Path Strength
## بخش 30 — Scoring Engine
## بخش 31 — Score Versioning
## بخش 32 — Recommendation Engine
- [x] Relationship Data
- [x] Interaction Data
- [x] Project Data
- [x] Network Data
- [x] Historical Data
- [x] Recommended Action
- [x] Reason
- [x] Confidence
- [x] Evidence
- [x] Priority
## بخش 33 — AI Architecture
## بخش 34 — AI Gateway
- [x] Authentication
- [x] Authorization
- [x] Prompt Management
- [x] Model Selection
- [x] Token Budget
- [x] Logging
- [x] Safety
- [x] Data Filtering
- [x] Output Validation
## بخش 35 — AI Use Cases
- [ ] Relationship Summary
- [ ] Meeting Brief
- [ ] Meeting Summary
- [ ] Action Extraction
- [ ] Commitment Extraction
- [ ] Relationship Risk Detection
- [ ] Opportunity Detection
- [ ] Next Best Action
- [ ] Connection Recommendation
- [ ] Smart Search
- [ ] Natural Language Query
- [ ] Executive Briefing
- [ ] Weekly Strategic Brief
## بخش 36 — RAG
- [ ] Document ingestion
- [ ] Chunking
- [ ] Embeddings
- [ ] Vector Search
- [ ] Metadata Filtering
- [ ] Permission-aware Retrieval
- [ ] Reranking
- [ ] Citation / Evidence
## بخش 37 — Vector Database
- [ ] PostgreSQL + pgvector
- [ ] بررسی Vector DB اختصاصی
## بخش 38 — AI Security
- [ ] Prompt Injection Protection
- [ ] Data Leakage Prevention
- [ ] Permission-aware retrieval
- [ ] Sensitive Data Filtering
- [ ] Output validation
- [ ] Tool permission boundaries
- [ ] AI action approval
- [ ] Audit AI actions
## بخش 39 — AI Agent
- [ ] اطلاعات جمع کند
- [ ] پیشنهاد دهد
- [ ] Brief بسازد
- [ ] Meeting آماده کند
- [ ] Action پیشنهاد کند
- [ ] ارسال Email
- [ ] تغییر داده حساس
- [ ] ایجاد Commitment
- [ ] اشتراک اطلاعات
- [ ] حذف اطلاعات
## بخش 40 — API Architecture
## بخش 41 — API Standards
- [ ] REST
- [ ] Versioning
- [ ] Pagination
- [ ] Filtering
- [ ] Sorting
- [ ] Search
- [ ] Idempotency
- [ ] Standard Error Format
- [ ] Request ID
- [ ] Correlation ID
- [ ] Rate Limiting
- [ ] OpenAPI
## بخش 42 — API Security
- [ ] JWT/OIDC validation
- [ ] Authorization per endpoint
- [ ] Input validation
- [ ] Output filtering
- [ ] Rate limiting
- [ ] CORS policy
- [ ] CSRF protection where applicable
- [ ] Security headers
- [ ] Request size limits
- [ ] File upload restrictions
## بخش 43 — Database Security
- [ ] Encryption at Rest
- [ ] Encryption in Transit
- [ ] Least privilege
- [ ] Separate application DB user
- [ ] Separate migration user
- [ ] No production root credentials
- [ ] Secrets خارج از Git
- [ ] Database backups
- [ ] Backup encryption
- [ ] Restore testing
## بخش 44 — Encryption
- [ ] TLS 1.2+ / preferably TLS 1.3
- [ ] Passwords با Password Hashing استاندارد
- [ ] Secrets در Secret Manager
- [ ] Encryption at Rest
- [ ] Encryption برای فایل‌های حساس
- [ ] Key Rotation
- [ ] Key Management
- [ ] عدم ذخیره Secret در Source Code
## بخش 45 — OWASP Security Checklist
- [ ] Encoding & Sanitization
- [ ] Validation & Business Logic
- [ ] Frontend Security
- [ ] API Security
- [ ] File Handling
- [x] Authentication
- [x] Session Management
- [x] Authorization
- [ ] Token Security
- [ ] OAuth/OIDC
- [ ] Cryptography
- [ ] Secure Communication
- [ ] Configuration
- [ ] Data Protection
- [ ] Secure Architecture
- [ ] Security Logging
## بخش 46 — Session Security
- [ ] Session expiration
- [ ] Idle timeout
- [ ] Absolute timeout
- [ ] Refresh token rotation
- [ ] Revocation
- [ ] Device list
- [ ] Logout all sessions
- [ ] Suspicious session detection
## بخش 47 — MFA
- [ ] TOTP
- [ ] Recovery Codes
- [ ] Optional Enterprise SSO
- [ ] Mandatory MFA برای Admin
- [ ] امکان Mandatory MFA برای کاربران حساس
## بخش 48 — Brute Force Protection
- [ ] Rate limiting
- [ ] Login attempt tracking
- [ ] Progressive delay
- [ ] Suspicious IP detection
- [ ] Account protection
- [ ] Alert برای Login مشکوک
## بخش 49 — File Security
- [x] MIME validation
- [x] Extension validation
- [x] Size limit
- [x] Virus/Malware scanning
- [x] Random storage name
- [x] عدم اجرای مستقیم فایل
- [x] Access control
- [x] Signed URL
- [x] Expiration
## بخش 50 — Audit System
- [x] Login
- [x] Logout
- [ ] Create
- [ ] Update
- [ ] Delete
- [ ] Export
- [ ] Permission Change
- [x] Role Change
- [ ] Sensitive Data Access
- [ ] AI Action
- [ ] File Download
## بخش 51 — Audit Log
- [ ] Actor
- [x] Action
- [ ] Entity
- [ ] Entity ID
- [ ] Timestamp
- [ ] IP
- [ ] User Agent
- [ ] Request ID
- [ ] Old Value
- [ ] New Value
- [ ] Reason در موارد لازم
## بخش 52 — Soft Delete
- [ ] Soft Delete
- [ ] Deleted By
- [ ] Deleted At
- [ ] Restore
- [ ] Permanent Delete با Permission خاص
## بخش 53 — Data Governance
- [x] Data Classification
- [x] Public / Internal / Confidential / Highly Confidential policy levels
- [x] Processing purpose and lawful basis
- [x] Retention policy
- [x] Data lifecycle tracking
## بخش 54 — GDPR / Privacy
- [x] Privacy by Design
- [x] Data Minimization
- [x] Purpose Limitation
- [x] Retention Policy
- [x] Data Export
- [x] Data Deletion / controlled anonymization
- [x] Access Request
- [x] Consent management در موارد لازم
- [x] Privacy Audit
## بخش 55 — Frontend Architecture
## بخش 56 — Monorepo
- [ ] pnpm
- [ ] Turborepo
- [ ] Shared Types
- [ ] Shared Validation
- [ ] Shared UI primitives
- [ ] Shared API Client
- [ ] Shared Business Contracts
## بخش 57 — Mobile Architecture
- [ ] Feature-based architecture
- [ ] Shared domain types
- [ ] API Client مشترک
- [ ] Secure storage
- [ ] Offline queue
## بخش 58 — Design System
- [ ] Typography
- [ ] Colors
- [ ] Spacing
- [ ] Border Radius
- [ ] Shadows
- [ ] Buttons
- [ ] Inputs
- [ ] Select
- [ ] Date Picker
- [ ] Modal
- [ ] Drawer
- [ ] Tabs
- [ ] Table
- [ ] Cards
- [ ] Timeline
- [ ] Graph
- [ ] KPI
- [ ] Charts
- [ ] Toast
- [x] Notifications
- [ ] Empty States
- [ ] Loading States
- [ ] Error States
## بخش 59 — Design Tokens
- [ ] Color Tokens
- [ ] Spacing Tokens
- [ ] Typography Tokens
- [ ] Radius Tokens
- [ ] Shadow Tokens
- [ ] Motion Tokens
## بخش 60 — Responsive Design
- [ ] Desktop
- [ ] Laptop
- [ ] Tablet
- [ ] Mobile Browser
## بخش 61 — Accessibility
- [ ] Keyboard Navigation
- [ ] Screen Reader
- [ ] Contrast
- [ ] Focus State
- [ ] Semantic HTML
- [ ] ARIA
- [ ] Reduced Motion
- [ ] Accessible Forms
- [ ] Accessible Tables
## بخش 62 — صفحه‌های اصلی Web
- [x] Login
- [x] MFA
- [x] Forgot Password
- [x] Dashboard
- [x] Organizations
- [x] Organization Profile
- [x] People
- [x] Person Profile
- [x] Relationships
- [x] Relationship Profile
- [x] Network
- [x] Meetings
- [x] Meeting Detail
- [x] Calendar
- [x] Actions
- [x] Commitments
- [x] Projects
- [x] Project Detail
- [x] Opportunities
- [x] Intelligence
- [x] Recommendations
- [x] Reports
- [x] Notifications
- [x] Search
- [x] Knowledge
- [x] Admin
## بخش 63 — Mobile Screens
- [x] Login
- [x] MFA
- [x] Home
- [x] Dashboard
- [x] Notifications
- [x] Search
- [x] Organization
- [x] Person
- [x] Relationship
- [x] Meeting
- [x] Meeting Brief
- [x] Add Interaction
- [x] Add Note
- [x] Action
- [x] Commitment
- [x] AI Assistant
- [x] Profile
- [x] Settings
- [x] Offline Queue
- [x] Sync
- [x] Conflict Resolution
- [x] Retry
- [x] Secure Storage
## بخش 64 — Dashboard
- [ ] KPI Cards
- [ ] Relationship Health
- [x] Opportunities
- [ ] Risks
- [ ] Today's Meetings
- [x] Actions
- [x] Commitments
- [ ] AI Recommendations
- [ ] Recent Activity
## بخش 65 — Relationship Page
- [ ] Header
- [ ] Health Score
- [ ] Strategic Score
- [ ] Risk
- [ ] Momentum
- [x] Owner
- [ ] People
- [ ] Timeline
- [x] Interactions
- [x] Meetings
- [x] Actions
- [x] Commitments
- [x] Opportunities
- [ ] Connection Paths
- [ ] AI Recommendations
## بخش 66 — Network Visualization
- [x] Organization Nodes
- [ ] Person Nodes
- [ ] Project Nodes
- [ ] Relationship Edges
- [ ] Edge Strength
- [ ] Risk Visualization
- [ ] Strategic Importance
- [ ] Search داخل Graph
- [ ] Zoom
- [ ] Pan
- [ ] Filter
- [ ] Focus Node
- [ ] Shortest Path
- [ ] Best Path
## بخش 67 — Meeting Intelligence UI
- [ ] Brief
- [ ] Relationship Health
- [ ] Last Meeting
- [ ] Open Commitments
- [ ] Key People
- [ ] Risks
- [x] Opportunities
- [ ] Suggested Agenda
- [x] Summary
- [ ] Decisions
- [x] Actions
- [x] Commitments
- [ ] AI Suggestions
## بخش 68 — Global Search UI
- [ ] Search Everything
- [ ] Recent Search
- [ ] Suggested Search
- [ ] Filters
- [x] Organization
- [x] Person
- [x] Relationship
- [x] Meeting
- [x] Project
- [x] Document
- [ ] AI Search
## بخش 69 — Notifications
- [ ] Real-time
- [ ] Push
- [x] Email
- [ ] In-App
- [x] Priority
- [ ] Read/Unread
- [ ] Grouping
- [ ] Deep Link
## بخش 70 — Calendar
- [ ] Day
- [ ] Week
- [ ] Month
- [ ] Meeting creation
- [ ] Meeting update
- [ ] Reminder
- [ ] Participant
- [ ] Calendar sync
## بخش 71 — Offline Mobile
- [ ] Note ثبت کند
- [ ] Interaction ثبت کند
- [ ] Contact ثبت کند
- [ ] Meeting Note ثبت کند
- [ ] Action ثبت کند
- [ ] Sync Queue
- [ ] Conflict Resolution
- [ ] Retry
- [ ] Sync Status
## بخش 72 — Notifications Architecture
- [ ] In-App
- [ ] Push
- [x] Email
## بخش 73 — Event Bus
- [x] OrganizationCreated
- [ ] PersonCreated
- [ ] RelationshipCreated
- [ ] InteractionCreated
- [ ] MeetingCreated
- [ ] MeetingCompleted
- [ ] CommitmentCreated
- [ ] CommitmentOverdue
- [ ] ActionCompleted
- [ ] RelationshipScoreChanged
- [ ] OpportunityCreated
- [ ] RecommendationCreated
## بخش 74 — Workflow Engine
## بخش 75 — Example Workflow
- [ ] Relationship Score < 50
- [ ] Risk Alert
- [ ] Create Review Task
- [ ] Notify Owner
- [ ] Notify Manager
## بخش 76 — Recommendation Pipeline
## بخش 77 — Recommendation Types
- [x] Follow-up
- [x] Meeting
- [ ] Introduction
- [ ] Relationship Repair
- [ ] Relationship Diversification
- [x] Opportunity
- [ ] Risk Mitigation
- [ ] Project Connection
- [ ] Executive Escalation
## بخش 78 — Observability
- [ ] Application Logs
- [ ] Error Tracking
- [ ] Metrics
- [ ] Tracing
- [ ] API Latency
- [ ] DB Latency
- [ ] Queue Monitoring
- [ ] AI Latency
- [ ] AI Cost
- [ ] User Activity
## بخش 79 — Monitoring
- [ ] CPU
- [ ] Memory
- [ ] DB
- [x] Redis
- [x] API
- [ ] Queue
- [ ] Storage
- [ ] Error Rate
- [ ] Response Time
- [ ] Availability
## بخش 80 — Error Tracking
- [ ] Sentry یا ابزار مشابه
- [ ] Error
- [ ] Stack Trace
- [x] User
- [x] Environment
- [ ] Request ID
- [ ] Version
## بخش 81 — CI/CD
- [ ] GitHub
- [ ] main
- [ ] develop
- [ ] feature/*
- [ ] fix/*
## بخش 82 — Pull Request
- [ ] Code Review
- [ ] Unit Tests
- [ ] Lint
- [ ] Type Check
- [ ] Security Scan
- [ ] Build
- [ ] Integration Tests
## بخش 83 — Environments
- [ ] Local
- [ ] Development
- [ ] Staging
- [ ] Production
- [ ] Database جدا
- [ ] Credentials جدا
- [ ] Secrets جدا
- [ ] Storage جدا
## بخش 84 — Deployment
- [ ] CDN
- [ ] Edge/Server deployment مناسب
- [ ] Containerized
- [ ] Managed Container / Kubernetes در صورت نیاز
- [ ] Managed PostgreSQL
- [ ] Managed Redis
- [ ] S3-compatible
## بخش 85 — Docker
- [ ] Dockerfile
- [ ] Multi-stage Build
- [ ] Non-root user
- [ ] Minimal image
- [ ] Health Check
- [ ] Environment separation
## بخش 86 — Infrastructure as Code
- [ ] Terraform
- [ ] Infrastructure repository
- [ ] Environment modules
- [ ] Secrets references
- [ ] Networking
- [ ] Database
- [x] Redis
- [ ] Storage
- [ ] Monitoring
## بخش 87 — Production Infrastructure
## بخش 88 — WAF
- [ ] Web Application Firewall
- [ ] DDoS Protection
- [ ] Bot Protection در صورت نیاز
- [ ] Rate Limiting
- [ ] IP Rules
- [ ] Geographic Rules در صورت نیاز
## بخش 89 — Secrets Management
- [ ] Secret Manager
- [ ] DB Password
- [ ] JWT/OIDC Secrets
- [ ] API Keys
- [ ] AI Provider Keys
- [ ] Storage Keys
- [ ] OAuth Secrets
- [ ] در Git
- [ ] در Frontend
- [ ] در Mobile Bundle
## بخش 90 — Backup
- [ ] Daily Backup
- [ ] Point-in-Time Recovery
- [ ] Retention Policy
- [ ] Encrypted Backup
- [ ] Cross-region backup در صورت نیاز
## بخش 91 — Disaster Recovery
- [ ] RPO
- [ ] RTO
## بخش 92 — Restore Test
- [ ] Restore واقعی تست شود.
- [ ] Disaster Drill انجام شود.
- [ ] Backup Integrity بررسی شود.
## بخش 93 — Performance
- [ ] Dashboard سریع
- [ ] API P95 مشخص
- [ ] Search سریع
- [ ] Pagination
- [ ] Lazy Loading
- [ ] Code Splitting
- [ ] Image Optimization
- [ ] Cache
- [ ] DB Indexing
## بخش 94 — Database Optimization
- [ ] EXPLAIN ANALYZE
- [ ] Index
- [ ] Composite Index
- [ ] Query Optimization
- [ ] Connection Pooling
- [ ] Slow Query Logging
## بخش 95 — Scalability
## بخش 96 — Caching Strategy
- [x] Organization summaries
- [ ] Dashboard metrics
- [ ] Reference data
- [ ] Frequently accessed relationships
- [ ] AI context
## بخش 97 — Testing
- [ ] Unit
- [x] Integration
- [ ] E2E
- [ ] Security
## بخش 98 — Unit Testing
- [ ] Score Engine
- [ ] Permission Engine
- [ ] Relationship Logic
- [ ] Workflow
- [x] Recommendation
- [ ] Validation
- [ ] Date/Time Logic
## بخش 99 — Integration Testing
- [x] API
- [ ] Database
- [ ] Auth
- [x] Redis
- [ ] Queue
- [ ] Storage
- [x] AI Gateway
## بخش 100 — E2E Testing
- [x] Login
- [ ] Create Organization
- [ ] Create Person
- [ ] Create Relationship
- [ ] Create Meeting
- [ ] Complete Meeting
- [ ] Extract Actions
- [ ] Create Commitment
- [x] Follow-up
- [x] Recommendation
- [ ] Permission Denial
## بخش 101 — Security Testing
- [ ] OWASP ASVS
- [ ] OWASP Top 10
- [ ] Authentication Tests
- [ ] Authorization Tests
- [ ] IDOR Tests
- [ ] SQL Injection
- [ ] XSS
- [ ] CSRF
- [ ] SSRF
- [ ] File Upload Attacks
- [ ] Rate Limit
- [ ] Session Attacks
- [ ] Prompt Injection
- [ ] Data Leakage
## بخش 102 — Penetration Test
- [ ] External Pentest
- [ ] Internal Security Review
- [ ] API Pentest
- [ ] Mobile Pentest
- [ ] Web Pentest
- [ ] Remediation
- [ ] Re-test
## بخش 103 — Mobile Security
- [ ] Secure Storage
- [ ] Certificate validation مناسب
- [ ] No secrets in bundle
- [ ] Debug disabled in production
- [ ] Root/Jailbreak risk assessment
- [ ] Screenshot protection برای صفحات بسیار حساس در صورت نیاز
- [ ] Clipboard protection برای داده حساس در صورت نیاز
- [ ] Secure deep links
## بخش 104 — API Documentation
- [ ] Swagger
- [ ] OpenAPI
- [ ] Authentication docs
- [ ] Error codes
- [ ] Examples
- [ ] Pagination
- [ ] Filters
- [ ] Webhooks
## بخش 105 — Developer Documentation
- [ ] README
- [ ] Setup
- [x] Environment Variables
- [ ] Architecture
- [ ] Database
- [x] API
- [ ] Deployment
- [ ] Testing
- [ ] Security
- [ ] Troubleshooting
## بخش 106 — Git Repository Structure
## بخش 107 — Initial Repository Setup
- [ ] Git Repository
- [ ] Branch Protection
- [ ] CODEOWNERS
- [ ] Issue Templates
- [ ] PR Template
- [ ] Dependabot/Renovate
- [ ] Security Policy
- [ ] License
- [ ] README
## بخش 108 — Dependency Management
- [ ] Dependency Audit
- [ ] Lockfile
- [ ] Automated Updates
- [ ] Security Alerts
- [ ] Remove unused packages
- [ ] Pin critical versions
## بخش 109 — Logging Policy
- [ ] Password
- [ ] Token
- [ ] Secret
- [ ] Full sensitive document
- [ ] اطلاعات شخصی غیرضروری
## بخش 110 — Localization
- [ ] فارسی
- [ ] English
- [ ] RTL
- [ ] LTR
- [ ] Persian Date
- [ ] Gregorian Date
- [ ] Timezone
- [ ] Number Formatting
## بخش 111 — Timezone
- [ ] UTC
- [ ] User Timezone
## بخش 112 — Internationalization
- [ ] i18n
- [ ] Translation Files
- [ ] RTL Support
- [ ] Date Format
- [ ] Currency
- [ ] Number
- [ ] Locale
## بخش 113 — Data Import
- [x] CSV
- [x] Excel/XLSX
- [x] Column Mapping
- [x] Validation
- [x] Duplicate Detection
- [x] Preview
- [x] Approval
- [x] Import Report
## بخش 114 — Duplicate Detection
- [x] Organization Name similarity
- [x] Domain
- [x] Registration ID
- [x] Phone
- [x] Country corroboration
- [x] Person Name similarity
- [x] Person Email
- [x] Person Organization
- [x] Person Phone
- [x] In-file duplicate detection
## بخش 115 — Data Quality Dashboard
- [x] Duplicate Records
- [x] Missing Owners
- [x] Missing Contacts
- [x] Stale Relationships
- [x] Invalid Emails
- [x] Missing Organizations
- [x] Missing Dates
- [x] Incomplete Profiles
## بخش 116 — Admin Panel
- [x] Users
- [x] Roles
- [x] Permissions
- [x] Organizations
- [ ] Custom Fields
- [x] Tags
- [x] Relationship Types
- [ ] Interaction Types
- [x] Workflows
- [ ] Scoring Rules
- [ ] Notification Rules
- [ ] AI Settings
- [ ] Integrations
- [x] Audit
## بخش 117 — Feature Flags
- [ ] Feature Flag System
- [ ] AI
- [ ] Network Graph
- [ ] New Dashboard
- [ ] Experimental Features
- [ ] Beta Features
## بخش 118 — Analytics
- [ ] Active Users
- [ ] Feature Usage
- [ ] Search
- [x] Meetings
- [x] Recommendations
- [ ] Accepted Recommendations
- [ ] Successful Connections
- [ ] Relationship Updates
## بخش 119 — Product Analytics
## بخش 120 — AI Quality Metrics
- [ ] Recommendation Acceptance Rate
- [ ] Recommendation Success Rate
- [ ] Hallucination Rate
- [ ] User Correction Rate
- [ ] AI Latency
- [ ] AI Cost
- [ ] Retrieval Accuracy
## بخش 121 — Cost Control AI
- [ ] Model Routing
- [x] Token Budget
- [ ] Caching
- [ ] Smaller Model for Simple Tasks
- [ ] Larger Model for Complex Tasks
- [ ] Usage Limits
- [ ] Cost Dashboard
## بخش 122 — AI Model Abstraction
## بخش 123 — Enterprise AI
- [ ] Private LLM
- [ ] On-premise AI
- [ ] Azure/OpenAI Enterprise-style deployment در صورت نیاز سازمانی
- [ ] Data Residency
- [ ] No-training policy بررسی شود
- [ ] Model logging policy
## بخش 124 — Meeting Recording
- [ ] Explicit consent
- [ ] Legal review
- [ ] Retention policy
- [ ] Encryption
- [ ] Access Control
- [ ] Delete
- [ ] Transcript permissions
## بخش 125 — Email Integration
- [ ] OAuth
- [ ] Permission scopes حداقلی
- [ ] Sync
- [ ] Thread mapping
- [x] Organization matching
- [ ] Person matching
- [ ] Relationship linking
## بخش 126 — Calendar Integration
- [ ] Google Calendar
- [ ] Microsoft Calendar
- [ ] OAuth
- [ ] Meeting sync
- [ ] Participant sync
- [ ] Update sync
- [ ] Cancellation sync
## بخش 127 — Microsoft Ecosystem
- [ ] Microsoft Entra ID
- [ ] Microsoft 365
- [ ] Outlook
- [ ] Teams
- [ ] SharePoint
- [ ] Graph API
## بخش 128 — Google Ecosystem
- [ ] Google Workspace
- [ ] Gmail
- [ ] Google Calendar
- [ ] Google Drive
## بخش 129 — Webhooks
- [ ] Meeting Created
- [ ] Meeting Updated
- [ ] Relationship Updated
- [ ] Opportunity Created
- [ ] Commitment Overdue
- [ ] User Created
## بخش 130 — Rate Limits
- [ ] Global Rate Limit
- [ ] User Rate Limit
- [ ] IP Rate Limit
- [ ] Sensitive Endpoint Rate Limit
- [ ] AI Rate Limit
## بخش 131 — Health Checks
- [x] API
- [ ] DB
- [x] Redis
- [ ] Storage
- [ ] Queue
## بخش 132 — Zero Downtime
- [ ] Rolling Deployment
- [ ] Health Checks
- [ ] Database Migration Strategy
- [ ] Backward-compatible migrations
- [ ] Rollback Plan
## بخش 133 — Database Migration
- [ ] Versioned migrations
- [ ] Migration review
- [ ] Backup before risky migration
- [ ] Rollback strategy
- [ ] Production migration test
## بخش 134 — Release Strategy
- [ ] Semantic Versioning
- [ ] Changelog
- [ ] Release Notes
- [ ] Staging validation
- [ ] Production approval
- [ ] Rollback
## بخش 135 — Mobile Release
- [ ] Development Build
- [ ] Internal Testing
- [ ] TestFlight
- [ ] Google Internal Testing
- [ ] Beta
- [ ] Production
## بخش 136 — App Security
- [ ] Production signing
- [ ] Secure credentials
- [ ] App Store certificates
- [ ] Google Play credentials
- [ ] OTA update policy
- [ ] Version enforcement
- [ ] Minimum supported version
## بخش 137 — Web Performance
- [ ] Server Rendering مناسب
- [ ] Streaming در موارد لازم
- [ ] Lazy Loading
- [ ] Dynamic Imports
- [ ] Image Optimization
- [ ] Font Optimization
- [ ] Caching
- [ ] CDN
- [ ] Bundle Analysis
## بخش 138 — Mobile Performance
- [ ] List virtualization
- [ ] Image optimization
- [ ] Offline caching
- [ ] Minimize re-render
- [ ] Background task control
- [ ] Battery optimization
## بخش 139 — Search Performance
- [ ] Indexing
- [ ] Debounced Search
- [ ] Pagination
- [ ] Ranking
- [ ] Permission-aware filtering
- [ ] Fuzzy matching
## بخش 140 — Network Performance
- [ ] Graph query optimization
- [ ] Limit node count
- [ ] Lazy Graph expansion
- [ ] Server-side path calculation
- [ ] Avoid rendering thousands of nodes simultaneously
## بخش 141 — Notification Preferences
- [x] Email
- [ ] Push
- [ ] In-App
- [ ] Critical Only
- [ ] Daily Digest
- [ ] Weekly Digest
## بخش 142 — User Preferences
- [ ] Language
- [ ] Timezone
- [ ] Theme
- [ ] Dashboard Layout
- [ ] Notification Preferences
- [ ] Default Company
- [ ] Default Calendar
## بخش 143 — Theme
- [ ] Light
- [ ] Dark
- [ ] System
## بخش 144 — Data Export
- [ ] CSV
- [ ] Excel
- [ ] PDF
- [ ] JSON برای Admin
- [ ] Export Audit
- [ ] Permission Check
## بخش 145 — Reporting Engine
- [ ] Relationship Health
- [ ] Relationship Risk
- [ ] Network
- [x] Meeting
- [x] Opportunity
- [x] Project
- [ ] Company
- [ ] Executive
- [ ] Holding
## بخش 146 — Executive Report
- [ ] Executive Summary
- [ ] KPI
- [ ] Trends
- [ ] Risks
- [x] Opportunities
- [x] Recommendations
- [ ] Supporting Data
## بخش 147 — AI Executive Brief
- [ ] Relationship Changes
- [ ] New Opportunities
- [ ] Risks
- [ ] Important Meetings
- [ ] Critical Commitments
- [ ] Recommended Actions
## بخش 148 — Data Lifecycle
- [ ] Creation
- [ ] Active
- [ ] Archived
- [ ] Retention
- [ ] Deletion
## بخش 149 — Business Continuity
- [ ] Backup
- [ ] Failover
- [ ] Disaster Recovery
- [ ] Incident Response
- [ ] Security Incident Plan
- [ ] Communication Plan
## بخش 150 — Incident Management
- [ ] P1 Critical
- [ ] P2 High
- [ ] P3 Medium
- [ ] P4 Low
- [ ] Detection
- [ ] Triage
- [ ] Containment
- [ ] Resolution
- [ ] Root Cause
- [ ] Postmortem
## بخش 151 — Security Incident
- [ ] Credential leak
- [ ] Data breach
- [ ] Suspicious access
- [ ] Malware
- [ ] API abuse
- [ ] AI data leakage
## بخش 152 — Architecture Decision Records
- [ ] ADR
## بخش 153 — Technical Documentation
- [ ] System Architecture
- [ ] Database Architecture
- [ ] API Documentation
- [ ] Security Architecture
- [ ] AI Architecture
- [ ] Deployment
- [ ] Disaster Recovery
- [ ] Runbook
- [ ] Developer Guide
- [ ] Admin Guide
- [ ] User Guide
## بخش 154 — Development Workflow
## بخش 155 — Definition of Done
- [ ] UX کامل
- [ ] Backend کامل
- [ ] API کامل
- [ ] Validation
- [x] Authorization
- [ ] Error Handling
- [ ] Tests
- [ ] Audit در صورت نیاز
- [x] Documentation
- [ ] Mobile در صورت مرتبط بودن
- [ ] Responsive
- [ ] Accessibility
- [ ] Security Review
- [ ] Staging Test
- [ ] Product Approval
## بخش 156 — اولین Sprint
- [x] Repository
- [x] Monorepo
- [x] Web App
- [x] Mobile App
- [x] API
- [x] PostgreSQL
- [x] Redis
- [x] Docker
- [ ] CI/CD
- [x] Environment
- [x] Authentication
- [x] Design System
- [x] Logging
- [ ] Error Tracking
- [x] Basic Security
## بخش 157 — Sprint 1
- [x] Login
- [ ] MFA
- [x] User
- [x] Roles
- [x] Permissions
- [ ] Holding
- [ ] Subsidiary
- [x] Organization
- [x] Person
## بخش 158 — Sprint 2
- [x] Relationship
- [x] Relationship Types
- [x] Relationship Status
- [x] Relationship Owner
- [x] Relationship Score
- [ ] Relationship Timeline
- [x] Relationship Profile
## بخش 159 — Sprint 3
- [x] Call
- [x] Email
- [x] Meeting
- [x] Note
- [x] Interaction Timeline
- [x] Follow-up
## بخش 160 — Sprint 4
- [x] Action
- [x] Commitment
- [x] Deadline
- [ ] Reminder
- [x] Notification
- [x] Overdue
## بخش 161 — Sprint 5
- [x] Project
- [x] Requirements
- [x] Project Relationships
- [x] Project Actions
- [x] Opportunity
## بخش 162 — Sprint 6
- [ ] Network Graph
- [ ] Connection Paths
- [ ] Best Connection
- [ ] Cross-company Network
## بخش 163 — Sprint 7
- [ ] Relationship Health
- [ ] Risk Detection
- [ ] Relationship Decay
- [ ] Connector Score
- [ ] Strategic Coverage
## بخش 164 — Sprint 8
- [x] AI Gateway
- [ ] RAG
- [ ] Meeting Brief
- [ ] Meeting Summary
- [x] Recommendation
- [ ] Natural Language Search
## بخش 165 — Sprint 9
- [ ] Calendar
- [x] Email
- [ ] Microsoft
- [ ] Google
- [ ] Push Notification
## بخش 166 — Sprint 10
- [x] Advanced RBAC
- [ ] ABAC
- [x] Audit
- [ ] Data Governance
- [ ] Reporting
- [ ] Advanced Security
## بخش 167 — Sprint 11
- [ ] Performance
- [ ] Security Audit
- [ ] Pentest
- [ ] Backup
- [ ] Disaster Recovery
- [ ] Monitoring
- [ ] Load Test
## بخش 168 — Sprint 12
- [ ] Production Infrastructure
- [ ] Domain
- [ ] SSL
- [ ] WAF
- [ ] Monitoring
- [ ] Mobile Release
- [ ] App Store
- [ ] Play Store
- [ ] User Training
- [x] Documentation
- [ ] Support Process
## بخش 169 — Launch Checklist
- [x] Production database
- [ ] Production secrets
- [ ] Backup
- [ ] Monitoring
- [ ] Error tracking
- [ ] WAF
- [ ] Rate limits
- [x] Authentication
- [ ] MFA
- [x] Authorization
- [x] Audit
- [x] Email
- [ ] Push
- [ ] Storage
- [ ] Search
- [ ] AI
- [x] Mobile
- [x] Web
- [ ] Legal
- [ ] Privacy
- [ ] Terms
- [ ] Incident Response
- [ ] Rollback
## بخش 170 — معیارهای Performance اولیه
- [ ] صفحه اصلی سریع در شبکه معمولی
- [ ] APIهای معمولی P95 کمتر از 500ms در شرایط عادی
- [ ] Search P95 کمتر از 1s برای Queryهای معمول
- [ ] Dashboard با Cache مناسب سریع باشد
- [ ] Login سریع و پایدار باشد
- [ ] Network Graph با Progressive Loading
## بخش 171 — Load Testing
- [ ] 100 concurrent users
- [ ] 500 concurrent users
- [ ] 1,000 concurrent users
- [ ] Peak traffic
- [ ] Search Load
- [ ] Dashboard Load
- [ ] Graph Load
- [ ] AI Load
- [ ] File Upload
- [ ] Notification Burst
## بخش 172 — Database Load Test
- [ ] Large Organization dataset
- [ ] Large Person dataset
- [ ] Millions of Interactions
- [ ] Large Relationship graph
- [ ] Complex queries
- [ ] Concurrent writes
## بخش 173 — AI Load Test
- [ ] Concurrent AI requests
- [ ] Long documents
- [ ] Large context
- [ ] RAG load
- [ ] Timeout
- [ ] Provider failure
- [ ] Retry
- [ ] Fallback model
## بخش 174 — AI Failure Strategy
- [ ] Application همچنان کار کند.
- [ ] Core CRM/Relationship functionality نباید به AI وابسته باشد.
- [ ] Retry
- [ ] Fallback
- [ ] Graceful degradation
## بخش 175 — Core Principle
## بخش 176 — Data Ownership
## بخش 177 — Relationship Governance
- [x] Owner
- [ ] Backup
- [ ] Review Frequency
- [ ] Strategic Score
- [ ] Risk
- [ ] Plan
- [ ] Next Action
## بخش 178 — Relationship Review
- [ ] Monthly Review
- [ ] Quarterly Review
## بخش 179 — Strategic Relationship Plan
- [x] Objective
- [ ] Stakeholders
- [ ] Current Position
- [ ] Desired Position
- [ ] Strategy
- [x] Actions
- [ ] Risks
- [ ] KPIs
## بخش 180 — Network Intelligence
- [ ] Centrality
- [ ] Influence
- [ ] Clustering
- [ ] Bridge Nodes
- [ ] Bottlenecks
- [ ] Single Points of Failure
## بخش 181 — Bridge Person
## بخش 182 — Relationship Opportunity Detection
## بخش 183 — Recommendation Confidence
- [x] Confidence
- [x] Evidence
- [x] Reason
## بخش 184 — Human Approval
- [ ] Approve
- [ ] Reject
- [ ] Edit
- [ ] Snooze
- [ ] Assign
## بخش 185 — Explainability
- [ ] داده‌های مؤثر
- [x] Score
- [ ] تاریخچه
- [x] Relationship
- [x] Evidence
## بخش 186 — Final Architecture
## بخش 187 — Build Order نهایی
- [ ] 1. Product Requirements نهایی
- [ ] 2. UX Architecture
- [ ] 3. Technical Architecture
- [ ] 4. Repository
- [ ] 5. Monorepo
- [ ] 6. Infrastructure
- [ ] 7. Database
- [ ] 8. Authentication
- [ ] 9. Authorization
- [ ] 10. Design System
- [ ] 11. Organization
- [ ] 12. Person
- [ ] 13. Relationship
- [ ] 14. Interaction
- [ ] 15. Meeting
- [ ] 16. Action
- [ ] 17. Commitment
- [ ] 18. Project
- [ ] 19. Opportunity
- [ ] 20. Network
- [ ] 21. Search
- [ ] 22. Notifications
- [ ] 23. Workflow
- [ ] 24. Analytics
- [ ] 25. AI Gateway
- [ ] 26. RAG
- [ ] 27. Recommendation Engine
- [ ] 28. Calendar
- [ ] 29. Email
- [ ] 30. Mobile
- [ ] 31. Security Hardening
- [ ] 32. Performance
- [ ] 33. Load Testing
- [ ] 34. Pentest
- [ ] 35. UAT
- [ ] 36. Production
- [ ] 37. Monitoring
- [ ] 38. Launch
## بخش 188 — مهم‌ترین قانون اجرایی پروژه
## بخش 189 — چیزی که از ابتدا نباید انجام دهیم
- [ ] شروع مستقیم از UI
- [ ] ساخت Authentication دستی بدون دلیل
- [ ] قرار دادن Business Logic در Frontend
- [ ] اتصال مستقیم Frontend به Database
- [ ] ذخیره Secret در Frontend
- [ ] ذخیره Token حساس در LocalStorage بدون طراحی امنیتی مناسب
- [ ] ساخت Graph Database بدون Benchmark
- [ ] وابسته کردن سیستم به یک AI Provider
- [ ] اجازه دسترسی آزاد AI به Database
- [ ] نبود Audit Log
- [ ] نبود Permission Model
- [ ] نبود Backup
- [ ] نبود Testing
- [ ] استفاده از Canary در Production
- [ ] استفاده از Packageهای بدون نگهداری
- [ ] ساخت Microserviceهای متعدد از روز اول بدون نیاز
## بخش 190 — معماری‌ای که پیشنهاد می‌کنم
## بخش 191 — چرا Modular Monolith
- [ ] سریع‌تر توسعه داده می‌شود.
- [ ] Debug ساده‌تر است.
- [ ] Deployment ساده‌تر است.
- [ ] هزینه Infrastructure کمتر است.
- [ ] Transactionهای Database ساده‌ترند.
- [ ] برای MVP و Enterprise اولیه مناسب‌تر است.
- [ ] بعداً قابلیت جداشدن Moduleها وجود دارد.
## بخش 192 — Final Technology Recommendation
- [x] Next.js
- [x] React
- [x] TypeScript
- [x] Tailwind
- [x] Design System
- [x] React Native
- [x] Expo
- [x] Expo Router
- [x] TypeScript
- [x] Node.js
- [x] NestJS
- [x] TypeScript
- [x] PostgreSQL
- [x] Redis
- [x] BullMQ
- [ ] pgvector
- [ ] S3-compatible
- [ ] PostgreSQL FTS ابتدا
- [ ] OpenSearch در صورت رشد
- [ ] OIDC Provider
- [x] Docker
- [ ] Terraform
- [ ] Managed Cloud Infrastructure
- [x] GitHub Actions
- [ ] Sentry
- [ ] Metrics
- [ ] Logs
- [ ] Tracing
- [x] AI Gateway
- [ ] RAG
- [ ] Embeddings
- [ ] Model abstraction
- [x] OWASP ASVS 5.0
- [ ] OWASP Mobile Security
## بخش 193 — Definition of Production Ready
- [ ] Authentication امن باشد.
- [ ] MFA فعال باشد.
- [ ] Authorization تست شده باشد.
- [ ] Audit Log فعال باشد.
- [ ] Backup فعال باشد.
- [ ] Restore تست شده باشد.
- [ ] Monitoring فعال باشد.
- [ ] Error Tracking فعال باشد.
- [ ] WAF فعال باشد.
- [ ] Rate Limiting فعال باشد.
- [ ] Secrets Management فعال باشد.
- [ ] Penetration Test انجام شده باشد.
- [ ] Load Test انجام شده باشد.
- [ ] Mobile Security بررسی شده باشد.
- [ ] API Security بررسی شده باشد.
- [ ] GDPR/Privacy بررسی شده باشد.
- [ ] Disaster Recovery تست شده باشد.
- [ ] Rollback تست شده باشد.
- [ ] Documentation تکمیل شده باشد.
## بخش 194 — Definition of Success
## بخش 195 — دستور اجرای پروژه با ما
- [x] قفل کردن Architecture
- [x] ساخت Repository
- [x] ساخت Development Environment
- [x] ساخت Database
- [x] ساخت Authentication
- [x] ساخت Design System
- [x] ساخت Core Domain
- [x] ساخت Relationship Engine
- [x] ساخت Meeting/Interaction
- [x] ساخت Project/Opportunity
- [ ] ساخت Network
- [ ] ساخت Intelligence
- [ ] ساخت AI
- [x] ساخت Mobile
- [x] Integration
- [ ] Security
- [ ] Testing
- [ ] Production
## بخش 196 — اولین چیزی که باید واقعاً بسازیم
- [ ] 1. Final Product Requirements Document
- [ ] 2. Final System Architecture
- [ ] 3. Complete Database ERD
- [ ] 4. Complete API Contract
- [ ] 5. UI/UX Design System + Screen Map
## بخش 197 — خروجی مورد انتظار مرحله بعد
- [x] ساختار واقعی Repository
- [x] apps/web
- [x] apps/mobile
- [x] apps/api
- [x] packages/ui
- [x] packages/types
- [x] packages/validation
- [x] packages/api-client
- [x] Docker
- [x] PostgreSQL
- [x] Redis
- [x] Environment Variables
- [x] Authentication
- [ ] اولین Migration
- [x] اولین API
- [ ] اولین صفحه Login
- [x] اولین Dashboard
- [x] CI Pipeline
- [x] Development Workflow

## Status
- Checked: **{checked}**
- Pending: **{total-checked}**
- Total checkbox items: **{total}**
- Production-ready: **No** — security, authorization, testing, infrastructure and operational gates remain intentionally unchecked.