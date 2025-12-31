# Temporal Server with auto-setup for schema creation
# This image automatically creates the required database schemas on first run
FROM temporalio/auto-setup:1.25.2

# Expose gRPC port for workers and UI
EXPOSE 7233

# Health check endpoint for Render
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD tctl --address localhost:7233 cluster health || exit 1

# The auto-setup image handles everything:
# - Creates temporal and temporal_visibility databases
# - Runs schema migrations
# - Starts the Temporal server
