# Architecture rules

- Project lists fetch only metadata and persisted folder summaries; fetch file contents by ID on opening a project, avoiding bulk file downloads.
- Share project-list queries by authenticated user and deployment platform, and render long pickers with virtualization to keep opening independent of list size.