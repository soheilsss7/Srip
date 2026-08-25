# PHASE N — Canonical Notification Rule Engine

Event flow:

Domain Event → Notification Rule Engine → Rule/Event/Condition checks → Recipient Resolver → User Preference → Provider → Delivery Log

The engine subscribes to the canonical EventBus, evaluates active rules, supports exact/wildcard event matching, organization scoping, conditions, owner/actor/organization-member/user recipients, channel preferences, and delivery deduplication per rule/event/user/channel.
