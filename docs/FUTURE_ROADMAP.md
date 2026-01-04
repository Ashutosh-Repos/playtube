# Future Roadmap & Technical Considerations

This document outlines architectural improvements and non-functional requirements planned for future iterations of the Video Pipeline.

## 1. Cost Optimization (Storage Lifecycle)
**Context**: We currently store the original uploaded video file (`uploads/{videoId}/original`) indefinitely in MinIO/S3.
**Proposal**:
- Implement an S3 Lifecycle Policy to transition objects with the prefix `uploads/` to **Cold Storage** (e.g., AWS Glacier, Cloudflare R2 Infrequent Access) after **30 days**.
- **Benefit**: Reduces storage costs by ~60-80% for master files that are rarely accessed (we serve HLS renditions to users).
- **Implementation Note**: Since we are currently using MinIO on Railway, this would be configured via MinIO Client (`mc`) lifecycle commands or via the Railway volume settings if/when we migrate to a managed S3 provider.

## 2. Distributed Tracing (OpenTelemetry)
**Context**: A video upload spans multiple services (`api` -> `video-service` -> `rabbitmq` -> `transcoder`). Debugging failures requires correlating logs across these boundaries.
**Proposal**:
- Instrument all services with **OpenTelemetry (OTel)**.
- Pass a `traceId` (W3C standard) in RabbitMQ message headers.
- **Benefit**: Allows visualization of the entire request waterfall in tools like Jaeger, Honeycomb, or SigNoz. Use cases include identifying latency bottlenecks (e.g., "Why did the Probe step take 10s?") and root-causing stuck jobs.

## 3. Advanced Transcoding Features
- **DASH Support**: Add support for MPEG-DASH packaging alongside HLS for broader ecosystem compatibility.
- **Per-Title Encoding**: Instead of fixed bitrates (e.g., 6Mbps for 1080p), analyze complexity to save bandwidth on simple videos (cartoons vs sports).
