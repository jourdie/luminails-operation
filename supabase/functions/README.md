# Server functions

Core writes run in PostgreSQL RPC transactions; no service role credentials are used by the browser. Future Shopee Income Report ingestion and privileged invitation emails belong in authenticated Edge Functions. Membership allowlisting is currently performed by the owner through `manage_member`; it does not send email.
