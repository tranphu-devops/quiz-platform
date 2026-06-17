-- =============================================================
-- AWS SAA Exam Set — 3 bộ đề thi AWS Solutions Architect Associate
-- Nguồn: https://app.notion.com/p/AWS-SAA-38266825836880169e78d4c9f59e4d03
--
-- Cách import:
--   docker compose exec postgres psql -U postgres -d quizdb -f /docker-entrypoint-initdb.d/seed_aws_saa.sql
-- Hoặc mount file vào container rồi chạy psql trực tiếp.
--
-- UUIDs dùng prefix c*/d* để không đụng với seed.sql (e*/b*/f*).
-- created_by = a0000000-0000-0000-0000-000000000002 (teacher từ seed.sql)
-- =============================================================

BEGIN;

-- ============================================================
-- EXAM 1 — Compute & Storage
-- ============================================================
INSERT INTO quiz_exams.exams (id, title, description, time_limit, passing_score, created_by, is_published, tags, show_explanation, allow_retake)
VALUES (
  'c1000000-0000-0000-0000-000000000001',
  'AWS SAA - Compute & Storage',
  'Các dịch vụ tính toán (EC2, Lambda, ECS, Fargate, Elastic Beanstalk...) và lưu trữ (S3, EBS, EFS, FSx, Storage Gateway) của AWS.',
  30, 70,
  'a0000000-0000-0000-0000-000000000002',
  true,
  ARRAY['AWS','SAA','Compute','Storage'],
  true, true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO quiz_exams.questions (id, exam_id, content, options, correct_answer, points, order_index, explanation, question_type) VALUES

('d1000000-0000-0000-0000-000000000001',
 'c1000000-0000-0000-0000-000000000001',
 'Loại EC2 instance nào phù hợp nhất cho workload không đều, khó dự đoán và không thể bị gián đoạn?',
 '[{"key":"A","text":"Spot Instance"},{"key":"B","text":"Reserved Instance"},{"key":"C","text":"On-Demand Instance"},{"key":"D","text":"Dedicated Host"}]',
 'C', 1, 1,
 '**On-Demand Instance** phù hợp nhất cho workload không thể bị gián đoạn.

- **Spot**: Rẻ hơn đến 90% nhưng AWS có thể thu hồi bất cứ lúc nào — không phù hợp cho workload quan trọng.
- **Reserved**: Giảm giá 1-3 năm nhưng phải cam kết capacity — phù hợp workload dự đoán được, ổn định.
- **On-Demand**: Trả tiền theo giây/giờ, không cam kết, không bị gián đoạn — linh hoạt nhất.
- **Dedicated Host**: Máy chủ vật lý riêng — dùng cho compliance/licensing.',
 'single'),

('d1000000-0000-0000-0000-000000000002',
 'c1000000-0000-0000-0000-000000000001',
 'AWS Lambda thuộc loại dịch vụ nào?',
 '[{"key":"A","text":"Container management service"},{"key":"B","text":"Serverless compute service"},{"key":"C","text":"Managed Kubernetes service"},{"key":"D","text":"Virtual machine service"}]',
 'B', 1, 2,
 '**AWS Lambda** là **serverless compute** — bạn chỉ viết code, AWS lo toàn bộ hạ tầng.

- Không cần quản lý server, tự động scale từ 0 đến hàng nghìn concurrent executions
- Timeout tối đa **15 phút**
- Tính phí theo số lần gọi + thời gian thực thi (milliseconds)
- Hỗ trợ: Python, Node.js, Java, Go, Ruby, .NET, và custom runtimes',
 'single'),

('d1000000-0000-0000-0000-000000000003',
 'c1000000-0000-0000-0000-000000000001',
 'Điểm khác biệt chính giữa Amazon ECS và Amazon EKS là gì?',
 '[{"key":"A","text":"ECS dùng Docker còn EKS không dùng Docker"},{"key":"B","text":"ECS là container orchestrator riêng của AWS, EKS dùng Kubernetes"},{"key":"C","text":"ECS chỉ chạy được trên Fargate còn EKS chạy trên EC2"},{"key":"D","text":"ECS hỗ trợ multi-region còn EKS chỉ single-region"}]',
 'B', 1, 3,
 '**ECS (Elastic Container Service)**: Orchestration engine độc quyền của AWS, đơn giản hơn, tích hợp sâu với AWS.

**EKS (Elastic Kubernetes Service)**: Kubernetes được quản lý — phù hợp nếu team đã quen Kubernetes hoặc cần tính di động (portability) sang cloud khác.

Cả hai đều chạy được trên **EC2** hoặc **Fargate** (serverless).',
 'single'),

('d1000000-0000-0000-0000-000000000004',
 'c1000000-0000-0000-0000-000000000001',
 'AWS Fargate là gì?',
 '[{"key":"A","text":"Dịch vụ DNS của AWS"},{"key":"B","text":"Dịch vụ lưu trữ tệp phân tán"},{"key":"C","text":"Serverless compute engine cho container (ECS và EKS)"},{"key":"D","text":"Dịch vụ CI/CD tự động"}]',
 'C', 1, 4,
 '**AWS Fargate** là serverless compute engine dành cho container:

- Không cần quản lý bất kỳ EC2 instance nào
- AWS tự lo provisioning, scaling, patching hạ tầng
- Hoạt động với cả **ECS** và **EKS**
- Trả phí theo vCPU và memory thực sự dùng
- Phù hợp khi không muốn quản lý cluster EC2',
 'single'),

('d1000000-0000-0000-0000-000000000005',
 'c1000000-0000-0000-0000-000000000001',
 'AWS Elastic Beanstalk được dùng chủ yếu để làm gì?',
 '[{"key":"A","text":"Phân tích log thời gian thực"},{"key":"B","text":"Triển khai và quản lý ứng dụng web tự động"},{"key":"C","text":"Quản lý cluster Kubernetes"},{"key":"D","text":"Chạy batch jobs quy mô lớn"}]',
 'B', 1, 5,
 '**AWS Elastic Beanstalk** cho phép deploy ứng dụng web nhanh chóng mà không cần quản lý hạ tầng.

- Hỗ trợ: Java, .NET, PHP, Node.js, Python, Ruby, Go, Docker
- Tự động lo: EC2, Load Balancer, Auto Scaling, CloudWatch
- Developer chỉ cần upload code, Beanstalk lo phần còn lại
- Vẫn có thể truy cập và tùy chỉnh tài nguyên bên dưới (khác Lambda hoàn toàn serverless)',
 'single'),

('d1000000-0000-0000-0000-000000000006',
 'c1000000-0000-0000-0000-000000000001',
 'Amazon S3 Glacier được sử dụng cho mục đích gì?',
 '[{"key":"A","text":"Lưu trữ dữ liệu truy cập thường xuyên với độ trễ thấp"},{"key":"B","text":"Lưu trữ cơ sở dữ liệu quan hệ"},{"key":"C","text":"Lưu trữ lạnh (archival) cho dữ liệu ít truy cập với chi phí rất thấp"},{"key":"D","text":"Block storage cho EC2 instance"}]',
 'C', 1, 6,
 '**Amazon S3 Glacier** là lớp lưu trữ dành cho dữ liệu archive lâu dài với chi phí rất thấp.

Các biến thể:
- **Glacier Instant Retrieval**: Truy xuất trong mili-giây, phù hợp archive truy cập 1 lần/quý
- **Glacier Flexible Retrieval**: Truy xuất vài phút đến vài giờ (Standard/Expedited/Bulk)
- **Glacier Deep Archive**: Rẻ nhất (~$0.00099/GB/tháng), truy xuất 12-48 giờ

Phù hợp: backup dài hạn, compliance archive, dữ liệu lịch sử.',
 'single'),

('d1000000-0000-0000-0000-000000000007',
 'c1000000-0000-0000-0000-000000000001',
 'EBS volume type nào phù hợp nhất cho database cần IOPS cao và ổn định?',
 '[{"key":"A","text":"General Purpose SSD (gp2/gp3)"},{"key":"B","text":"Provisioned IOPS SSD (io1/io2)"},{"key":"C","text":"Throughput Optimized HDD (st1)"},{"key":"D","text":"Cold HDD (sc1)"}]',
 'B', 1, 7,
 '**Provisioned IOPS SSD (io1/io2)** được thiết kế cho workload I/O chuyên sâu cần IOPS đảm bảo:

- io1/io2: Lên đến 64,000 IOPS per volume
- io2 Block Express: Lên đến 256,000 IOPS, sub-millisecond latency
- Phù hợp: MySQL, PostgreSQL, Oracle, SQL Server cần hiệu năng cao

**gp2/gp3**: General purpose, đủ dùng cho hầu hết workloads nhưng IOPS không guaranteed ở mức cực cao.
**st1/sc1**: HDD — throughput cao, IOPS thấp — dùng cho big data, log processing.',
 'single'),

('d1000000-0000-0000-0000-000000000008',
 'c1000000-0000-0000-0000-000000000001',
 'Điểm khác biệt chính giữa Amazon EFS và Amazon EBS là gì?',
 '[{"key":"A","text":"EBS hỗ trợ nhiều EC2 instance đồng thời, EFS chỉ mount vào 1 instance"},{"key":"B","text":"EFS là shared file system (NFS) cho nhiều EC2, EBS là block storage gắn vào 1 instance"},{"key":"C","text":"EFS chỉ dùng cho Windows, EBS cho Linux"},{"key":"D","text":"EBS lưu trữ đối tượng còn EFS lưu trữ khối"}]',
 'B', 1, 8,
 '**Amazon EFS (Elastic File System)**:
- Network File System (NFS) — mount đồng thời vào **nhiều EC2 instances** (kể cả cross-AZ)
- Tự động scale storage, không cần provision trước
- Phù hợp: shared content, web serving, home directories, CMS

**Amazon EBS (Elastic Block Store)**:
- Block storage gắn vào **1 EC2 instance** tại một thời điểm (trừ EBS Multi-Attach cho io1/io2)
- Hiệu năng cao hơn, latency thấp hơn EFS
- Phù hợp: OS drive, database, low-latency workloads',
 'single'),

('d1000000-0000-0000-0000-000000000009',
 'c1000000-0000-0000-0000-000000000001',
 'Amazon FSx for Lustre được thiết kế cho loại workload nào?',
 '[{"key":"A","text":"Windows file sharing trong doanh nghiệp (SMB protocol)"},{"key":"B","text":"Lưu trữ database quan hệ"},{"key":"C","text":"High Performance Computing (HPC) và machine learning"},{"key":"D","text":"Long-term archive và backup"}]',
 'C', 1, 9,
 '**Amazon FSx for Lustre** là file system hiệu năng cao tích hợp với S3:

- Được tối ưu hóa cho **HPC (High Performance Computing)**, machine learning, video processing, financial modeling
- Đạt hàng trăm GB/s throughput và hàng triệu IOPS
- Tích hợp trực tiếp với S3 (import/export data)
- Lustre là parallel file system phổ biến trong HPC

Các FSx khác:
- **FSx for Windows File Server**: SMB protocol, Windows enterprise file sharing
- **FSx for NetApp ONTAP**: Multi-protocol (NFS, SMB, iSCSI)
- **FSx for OpenZFS**: ZFS features trên AWS',
 'single'),

('d1000000-0000-0000-0000-000000000010',
 'c1000000-0000-0000-0000-000000000001',
 'AWS Storage Gateway cung cấp những loại gateway nào? (Chọn 3)',
 '[{"key":"A","text":"File Gateway"},{"key":"B","text":"Volume Gateway"},{"key":"C","text":"Block Gateway"},{"key":"D","text":"Tape Gateway"},{"key":"E","text":"Object Gateway"}]',
 'A,B,D', 2, 10,
 '**AWS Storage Gateway** có 3 loại chính:

1. **File Gateway**: NFS/SMB interface → lưu files dưới dạng S3 objects. On-premises apps truy cập như file share thông thường.
2. **Volume Gateway**: iSCSI block storage → dữ liệu on-premises, backup lên S3. Có 2 chế độ: Stored (primary on-prem) và Cached (primary S3).
3. **Tape Gateway**: Thay thế băng từ vật lý bằng virtual tape library → lưu trên S3 và Glacier.

Không có "Block Gateway" hay "Object Gateway" trong danh mục chính thức của AWS.',
 'multiple'),

('d1000000-0000-0000-0000-000000000011',
 'c1000000-0000-0000-0000-000000000001',
 'Sự khác biệt giữa S3 Standard-IA và S3 One Zone-IA là gì?',
 '[{"key":"A","text":"Standard-IA lưu ở 1 AZ, One Zone-IA lưu ở nhiều AZ"},{"key":"B","text":"Standard-IA lưu ở nhiều AZ (multi-AZ), One Zone-IA chỉ lưu ở 1 AZ"},{"key":"C","text":"Không có sự khác biệt về độ bền"},{"key":"D","text":"One Zone-IA đắt hơn Standard-IA"}]',
 'B', 1, 11,
 '**S3 Standard-IA (Infrequent Access)**:
- Lưu trữ ở **≥3 Availability Zones**
- Độ bền 99.999999999% (11 nines)
- Availability 99.9%

**S3 One Zone-IA**:
- Chỉ lưu ở **1 AZ** duy nhất
- Rẻ hơn Standard-IA khoảng 20%
- Phù hợp cho dữ liệu có thể tái tạo (thumbnail ảnh, secondary backup)
- Rủi ro mất dữ liệu nếu AZ đó có sự cố nghiêm trọng',
 'single'),

('d1000000-0000-0000-0000-000000000012',
 'c1000000-0000-0000-0000-000000000001',
 'AWS Batch khác AWS Lambda ở điểm nào?',
 '[{"key":"A","text":"Lambda không hỗ trợ container còn Batch thì có"},{"key":"B","text":"Batch dành cho các job tính toán hàng loạt chạy dài, Lambda dành cho xử lý sự kiện ngắn (max 15 phút)"},{"key":"C","text":"Batch chỉ chạy trên Fargate còn Lambda chạy trên EC2"},{"key":"D","text":"Lambda hỗ trợ nhiều ngôn ngữ hơn Batch"}]',
 'B', 1, 12,
 '**AWS Batch**:
- Chạy các **batch computing jobs** quy mô lớn, **không giới hạn** thời gian thực thi
- Tự động provision EC2 hoặc Fargate theo nhu cầu
- Hỗ trợ job queues, dependencies giữa jobs
- Phù hợp: genomics, financial simulation, rendering, ETL pipelines dài

**AWS Lambda**:
- Timeout tối đa **15 phút**
- Event-driven, phản ứng nhanh với sự kiện
- Phù hợp: API backend, S3/DynamoDB triggers, scheduled tasks ngắn',
 'single'),

('d1000000-0000-0000-0000-000000000013',
 'c1000000-0000-0000-0000-000000000001',
 'AWS App Runner phù hợp nhất cho trường hợp nào?',
 '[{"key":"A","text":"Quản lý Kubernetes cluster lớn với nhiều microservices phức tạp"},{"key":"B","text":"Chạy HPC workloads cần GPU cluster"},{"key":"C","text":"Deploy nhanh ứng dụng container hoặc source code mà không cần quản lý hạ tầng"},{"key":"D","text":"Di chuyển database từ on-premises lên AWS"}]',
 'C', 1, 13,
 '**AWS App Runner** cho phép deploy ứng dụng web/API cực kỳ nhanh:

- Không cần cấu hình VPC, Load Balancer, Auto Scaling
- Chỉ cần: container image (ECR) hoặc Git repo
- Tự động build, deploy và scale
- Pay-per-use
- Phù hợp cho: web apps, REST APIs đơn giản, prototype nhanh

Khác ECS/EKS: đơn giản hơn nhiều, không kiểm soát được infrastructure bên dưới. Developer-friendly nhất trong nhóm container services.',
 'single'),

('d1000000-0000-0000-0000-000000000014',
 'c1000000-0000-0000-0000-000000000001',
 'Dịch vụ nào phù hợp nhất để host website nhỏ với database cho người mới bắt đầu với AWS?',
 '[{"key":"A","text":"Amazon EC2 + RDS"},{"key":"B","text":"Amazon EKS + Aurora"},{"key":"C","text":"Amazon Lightsail"},{"key":"D","text":"AWS Fargate + DynamoDB"}]',
 'C', 1, 14,
 '**Amazon Lightsail** là giải pháp VPS đơn giản, phù hợp cho người mới bắt đầu:

- Gói cố định với giá rõ ràng (từ $3.5/tháng)
- Bundle gồm: compute, SSD storage, data transfer, DNS, static IP
- Templates sẵn: WordPress, LAMP, Node.js, MySQL, MEAN, Ghost...
- Không cần hiểu sâu về AWS networking, IAM, VPC
- Dễ upgrade lên EC2/RDS khi cần scale

Phù hợp: blog, landing page, dev/test environment, portfolio site.',
 'single'),

('d1000000-0000-0000-0000-000000000015',
 'c1000000-0000-0000-0000-000000000001',
 'S3 storage class nào được thiết kế cho dữ liệu truy cập không thường xuyên (Infrequent Access)? (Chọn 2)',
 '[{"key":"A","text":"S3 Standard"},{"key":"B","text":"S3 Standard-IA"},{"key":"C","text":"S3 One Zone-IA"},{"key":"D","text":"S3 Intelligent-Tiering"},{"key":"E","text":"S3 Express One Zone"}]',
 'B,C', 2, 15,
 'Hai storage class có "IA" (Infrequent Access) trong tên chính là đáp án:

- **S3 Standard-IA**: Ít truy cập, lưu ở nhiều AZ, phí truy xuất cao hơn Standard
- **S3 One Zone-IA**: Ít truy cập, chỉ 1 AZ, rẻ hơn Standard-IA ~20%

Cả hai đều có minimum storage duration 30 ngày và minimum object size 128KB.

**S3 Standard**: Truy cập thường xuyên, không phí truy xuất
**S3 Intelligent-Tiering**: Tự động di chuyển giữa tiers — phí monitoring/automation
**S3 Express One Zone**: High-performance single-AZ cho AI/ML, latency 10x thấp hơn Standard',
 'multiple');

-- ============================================================
-- EXAM 2 — Database & Networking
-- ============================================================
INSERT INTO quiz_exams.exams (id, title, description, time_limit, passing_score, created_by, is_published, tags, show_explanation, allow_retake)
VALUES (
  'c2000000-0000-0000-0000-000000000001',
  'AWS SAA - Database & Networking',
  'Các dịch vụ cơ sở dữ liệu (RDS, Aurora, DynamoDB, Redshift, ElastiCache...) và mạng (VPC, Route 53, CloudFront, ELB, Direct Connect...) của AWS.',
  30, 70,
  'a0000000-0000-0000-0000-000000000002',
  true,
  ARRAY['AWS','SAA','Database','Networking'],
  true, true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO quiz_exams.questions (id, exam_id, content, options, correct_answer, points, order_index, explanation, question_type) VALUES

('d2000000-0000-0000-0000-000000000001',
 'c2000000-0000-0000-0000-000000000001',
 'Amazon RDS hỗ trợ những database engine nào? (Chọn 3)',
 '[{"key":"A","text":"MySQL"},{"key":"B","text":"MongoDB"},{"key":"C","text":"PostgreSQL"},{"key":"D","text":"Cassandra"},{"key":"E","text":"Microsoft SQL Server"}]',
 'A,C,E', 2, 1,
 '**Amazon RDS** hỗ trợ 6 relational database engines:
- **MySQL**, **PostgreSQL**, **Microsoft SQL Server**, **Oracle**, **MariaDB**, **Amazon Aurora**

**MongoDB** → Dùng **Amazon DocumentDB** (MongoDB-compatible)
**Cassandra** → Dùng **Amazon Keyspaces** (Apache Cassandra-compatible)

RDS lo toàn bộ: automated backups, patching, Multi-AZ failover, read replicas.',
 'multiple'),

('d2000000-0000-0000-0000-000000000002',
 'c2000000-0000-0000-0000-000000000001',
 'Amazon Aurora Global Database dùng để làm gì?',
 '[{"key":"A","text":"Chạy Aurora trong nhiều VPC cùng region"},{"key":"B","text":"Replicate Aurora sang nhiều AWS Regions để đọc với độ trễ thấp và disaster recovery"},{"key":"C","text":"Scale Aurora lên hàng nghìn nodes"},{"key":"D","text":"Kết nối Aurora với on-premises database"}]',
 'B', 1, 2,
 '**Aurora Global Database** cho phép:
- **1 primary region** xử lý cả đọc và ghi
- Tối đa **5 secondary read-only regions**
- Replication lag **dưới 1 giây** giữa các regions (storage-level replication)
- **Disaster Recovery**: Promote secondary region thành primary trong ~1 phút (RPO ~1s, RTO ~1 phút)

Phù hợp cho: ứng dụng toàn cầu cần đọc với độ trễ thấp ở nhiều khu vực địa lý.',
 'single'),

('d2000000-0000-0000-0000-000000000003',
 'c2000000-0000-0000-0000-000000000001',
 'Amazon DAX (DynamoDB Accelerator) giải quyết vấn đề gì?',
 '[{"key":"A","text":"Giảm chi phí DynamoDB"},{"key":"B","text":"Tăng tốc độ đọc DynamoDB từ mili-giây xuống micro-giây"},{"key":"C","text":"Cho phép DynamoDB hỗ trợ SQL queries"},{"key":"D","text":"Replicate DynamoDB sang nhiều regions"}]',
 'B', 1, 3,
 '**DAX (DynamoDB Accelerator)** là **in-memory cache** được quản lý hoàn toàn cho DynamoDB:

- Cải thiện hiệu năng đọc từ **mili-giây → micro-giây**
- Không cần thay đổi application code (API compatible)
- Ideal cho read-heavy workloads, gaming leaderboards, session stores
- **Không phù hợp** cho: strongly consistent reads, write-heavy workloads, applications đã có cache layer

Khác ElastiCache: DAX chỉ cho DynamoDB; ElastiCache là general-purpose cache.',
 'single'),

('d2000000-0000-0000-0000-000000000004',
 'c2000000-0000-0000-0000-000000000001',
 'Amazon Redshift là gì?',
 '[{"key":"A","text":"NoSQL key-value database"},{"key":"B","text":"Graph database"},{"key":"C","text":"Data Warehouse (kho dữ liệu) quy mô petabyte dạng columnar"},{"key":"D","text":"In-memory cache"}]',
 'C', 1, 4,
 '**Amazon Redshift** là **Data Warehouse** dạng columnar dành cho phân tích:

- Quy mô petabyte, OLAP (Online Analytical Processing) — không phải OLTP
- **Redshift Spectrum**: Query trực tiếp dữ liệu trên S3 mà không cần load vào Redshift
- **Redshift ML**: Tạo và train ML models bằng SQL
- Tích hợp với: Tableau, Power BI, QuickSight, dbt

Khác RDS: Redshift cho analytics/reporting (aggregation trên hàng tỷ rows); RDS cho transactional (OLTP, nhiều insert/update/delete nhỏ).',
 'single'),

('d2000000-0000-0000-0000-000000000005',
 'c2000000-0000-0000-0000-000000000001',
 'Khi nào nên chọn ElastiCache Redis thay vì Memcached?',
 '[{"key":"A","text":"Khi chỉ cần cache đơn giản, không cần persistence hay replication"},{"key":"B","text":"Khi cần data persistence, replication, pub/sub, hoặc data structures phức tạp như Sorted Set"},{"key":"C","text":"Khi muốn horizontal scaling đơn giản với nhiều threads"},{"key":"D","text":"Khi muốn giảm chi phí tối đa"}]',
 'B', 1, 5,
 '**ElastiCache Redis** phù hợp khi cần:
- **Data persistence** (AOF/RDB backup)
- **Replication** (Multi-AZ, automatic failover)
- **Pub/Sub** messaging
- **Data structures** phức tạp: List, Set, **Sorted Set** (leaderboard), Hash, Bitmap, HyperLogLog
- **Geospatial** indexing
- **Transactions** và Lua scripting

**ElastiCache Memcached** phù hợp khi cần:
- Simple caching, không cần persistence
- Multi-threaded performance
- Horizontal scaling đơn giản (sharding)

Redis là lựa chọn phổ biến hơn cho hầu hết use cases hiện đại.',
 'single'),

('d2000000-0000-0000-0000-000000000006',
 'c2000000-0000-0000-0000-000000000001',
 'Amazon Neptune phù hợp nhất cho loại ứng dụng nào?',
 '[{"key":"A","text":"Ứng dụng cần xử lý time-series data từ IoT"},{"key":"B","text":"Ứng dụng mạng xã hội với mối quan hệ phức tạp giữa các thực thể"},{"key":"C","text":"Ứng dụng cần full-text search nhanh"},{"key":"D","text":"Ứng dụng OLAP analytics quy mô lớn"}]',
 'B', 1, 6,
 '**Amazon Neptune** là **graph database** — tối ưu cho dữ liệu có nhiều mối quan hệ phức tạp:

- **Social networks**: bạn bè, follower, người theo dõi chung
- **Recommendation engines**: sản phẩm liên quan, "người dùng này cũng mua"
- **Fraud detection**: chuỗi giao dịch đáng ngờ
- **Knowledge graphs**: ontologies
- **Network topology**: IT operations

Neptune hỗ trợ: **Gremlin** (Apache TinkerPop) và **SPARQL** (RDF/W3C standard)

Khác: DynamoDB (key-value), Timestream (time-series), OpenSearch (full-text search).',
 'single'),

('d2000000-0000-0000-0000-000000000007',
 'c2000000-0000-0000-0000-000000000001',
 'Load Balancer nào phù hợp nhất cho ứng dụng HTTP/HTTPS cần routing theo path hoặc hostname?',
 '[{"key":"A","text":"Network Load Balancer (NLB)"},{"key":"B","text":"Gateway Load Balancer (GWLB)"},{"key":"C","text":"Application Load Balancer (ALB)"},{"key":"D","text":"Classic Load Balancer (CLB)"}]',
 'C', 1, 7,
 '**Application Load Balancer (ALB)** hoạt động ở **Layer 7** (HTTP/HTTPS):

- **Path-based routing**: `/api/*` → Target Group A, `/web/*` → Target Group B
- **Host-based routing**: `api.example.com` → Service A, `app.example.com` → Service B
- Header-based, query string routing
- Hỗ trợ WebSocket, HTTP/2, gRPC
- Tích hợp với Cognito, WAF

**NLB**: Layer 4 (TCP/UDP), ultra-low latency, static IP — gaming, financial, IoT
**GWLB**: Layer 3, cho virtual network appliances (firewall, IDS/IPS của third-party)
**CLB**: Legacy, không nên dùng cho hệ thống mới',
 'single'),

('d2000000-0000-0000-0000-000000000008',
 'c2000000-0000-0000-0000-000000000001',
 'Sự khác biệt chính giữa AWS Global Accelerator và Amazon CloudFront là gì?',
 '[{"key":"A","text":"CloudFront tăng tốc TCP/UDP còn Global Accelerator chỉ cho HTTP"},{"key":"B","text":"Global Accelerator dùng AWS backbone network cho TCP/UDP, CloudFront là CDN cache content tĩnh/động"},{"key":"C","text":"Global Accelerator cung cấp SSL termination còn CloudFront thì không"},{"key":"D","text":"Không có sự khác biệt, cả hai đều là CDN"}]',
 'B', 1, 8,
 '**Amazon CloudFront** là **CDN** — cache content tại 400+ Edge Locations:
- Static assets, dynamic content, video streaming
- Lambda@Edge, CloudFront Functions
- Phù hợp: websites, APIs, media delivery

**AWS Global Accelerator** — dùng **AWS global backbone network**:
- **Không cache** content — là network accelerator thuần túy
- Tối ưu routing TCP/UDP qua mạng nội bộ AWS (tránh internet congestion)
- **2 static Anycast IP addresses** cố định (dễ whitelist)
- Failover nhanh hơn DNS-based (không phụ thuộc TTL)
- Phù hợp: gaming, IoT, VoIP, non-HTTP applications

Cả hai dùng AWS Edge Locations nhưng mục đích khác nhau.',
 'single'),

('d2000000-0000-0000-0000-000000000009',
 'c2000000-0000-0000-0000-000000000001',
 'AWS Direct Connect cung cấp điều gì mà Site-to-Site VPN thông thường không có?',
 '[{"key":"A","text":"Mã hóa dữ liệu trong transit"},{"key":"B","text":"Kết nối riêng tư, băng thông cao từ on-premises đến AWS không qua internet công cộng"},{"key":"C","text":"Kết nối miễn phí không tốn chi phí"},{"key":"D","text":"Hỗ trợ IPv6"}]',
 'B', 1, 9,
 '**AWS Direct Connect**:
- Kết nối **dedicated private network** từ datacenter/office đến AWS
- **Không đi qua internet công cộng**
- Băng thông: 1Gbps, 10Gbps, 100Gbps (hosted: 50Mbps-10Gbps)
- Ổn định, predictable latency và performance
- Chi phí cao, setup mất vài tuần

**AWS Site-to-Site VPN**:
- Đi qua **internet công cộng** với mã hóa IPsec
- Setup nhanh (vài phút), rẻ hơn
- Bandwidth và latency phụ thuộc chất lượng internet

Direct Connect phù hợp cho: enterprise hybrid cloud, di chuyển data lớn, latency-sensitive applications.',
 'single'),

('d2000000-0000-0000-0000-000000000010',
 'c2000000-0000-0000-0000-000000000001',
 'AWS Transit Gateway giải quyết vấn đề gì?',
 '[{"key":"A","text":"Tăng tốc truy xuất database"},{"key":"B","text":"Hub-and-Spoke: một điểm trung tâm kết nối nhiều VPCs và on-premises networks thay vì peering 1-1"},{"key":"C","text":"Cung cấp DNS tập trung cho nhiều VPC"},{"key":"D","text":"Bảo vệ khỏi tấn công DDoS"}]',
 'B', 1, 10,
 '**AWS Transit Gateway** là **network transit hub**:

- Kết nối hàng nghìn VPCs và on-premises networks
- **Hub-and-spoke model**: Mỗi VPC/network chỉ cần kết nối đến TGW, không cần peering trực tiếp
- Giải quyết vấn đề scaling của VPC Peering:
  - 10 VPCs dùng peering = 45 connections (N*(N-1)/2)
  - 10 VPCs dùng TGW = 10 connections
- Hỗ trợ multicast, cross-region peering, route tables per attachment
- Phù hợp cho: large enterprise với nhiều accounts/VPCs',
 'single'),

('d2000000-0000-0000-0000-000000000011',
 'c2000000-0000-0000-0000-000000000001',
 'Amazon Route 53 hỗ trợ những routing policy nào? (Chọn 3)',
 '[{"key":"A","text":"Weighted routing"},{"key":"B","text":"Latency-based routing"},{"key":"C","text":"CPU-based routing"},{"key":"D","text":"Failover routing"},{"key":"E","text":"Memory-based routing"}]',
 'A,B,D', 2, 11,
 '**Amazon Route 53** routing policies:
- **Simple**: 1 DNS record → 1 hoặc nhiều values
- **Weighted**: Phân phối traffic theo tỷ lệ (A/B testing, blue-green deploy)
- **Latency-based**: Route đến AWS Region có latency thấp nhất với user
- **Failover**: Active-passive, tự động chuyển sang secondary khi primary down
- **Geolocation**: Route theo vị trí địa lý của user (country/continent)
- **Geoproximity**: Route theo khoảng cách địa lý + bias (Traffic Flow)
- **Multi-value answer**: Trả về nhiều IPs kèm health check

Không có CPU-based hay Memory-based routing trong Route 53.',
 'multiple'),

('d2000000-0000-0000-0000-000000000012',
 'c2000000-0000-0000-0000-000000000001',
 'Amazon DocumentDB tương thích với hệ thống nào?',
 '[{"key":"A","text":"MySQL"},{"key":"B","text":"Redis"},{"key":"C","text":"MongoDB"},{"key":"D","text":"Apache Cassandra"}]',
 'C', 1, 12,
 '**Amazon DocumentDB** là managed document database **tương thích với MongoDB**:

- Dùng MongoDB drivers, tools hiện có mà không cần sửa application code
- AWS lo: patching, backup, Multi-AZ replication, automatic failover
- Storage tự động scale đến 64TB
- Phù hợp khi muốn migrate từ MongoDB self-managed sang fully managed service

Lưu ý: DocumentDB không phải là MongoDB fork — AWS tự build, implement MongoDB API. Một số MongoDB features nâng cao có thể chưa được hỗ trợ.',
 'single'),

('d2000000-0000-0000-0000-000000000013',
 'c2000000-0000-0000-0000-000000000001',
 'AWS PrivateLink phục vụ mục đích gì?',
 '[{"key":"A","text":"Kết nối on-premises với AWS qua đường cáp quang riêng"},{"key":"B","text":"Truy cập private services giữa VPCs hoặc dịch vụ AWS mà không đi qua internet công cộng"},{"key":"C","text":"Mã hóa toàn bộ traffic trong VPC"},{"key":"D","text":"Cung cấp static IP cho EC2"}]',
 'B', 1, 13,
 '**AWS PrivateLink** cho phép truy cập services **qua mạng nội bộ AWS**:

- Tạo **VPC Endpoint** trong VPC của bạn → kết nối đến service
- Traffic không rời khỏi AWS network, không cần Internet Gateway hay NAT
- Hai loại:
  - **Interface Endpoint** (PrivateLink): Elastic Network Interface với private IP → hỗ trợ hầu hết dịch vụ AWS
  - **Gateway Endpoint**: Chỉ cho S3 và DynamoDB (miễn phí)

Ví dụ: EC2 trong private subnet query DynamoDB hoặc upload lên S3 qua VPC Endpoint, không cần NAT Gateway.',
 'single'),

('d2000000-0000-0000-0000-000000000014',
 'c2000000-0000-0000-0000-000000000001',
 'Database nào phù hợp nhất cho dữ liệu chuỗi thời gian (time-series) từ thiết bị IoT?',
 '[{"key":"A","text":"Amazon RDS PostgreSQL"},{"key":"B","text":"Amazon Redshift"},{"key":"C","text":"Amazon Timestream"},{"key":"D","text":"Amazon Neptune"}]',
 'C', 1, 14,
 '**Amazon Timestream** là database **time-series** chuyên biệt:

- Tối ưu hóa cho dữ liệu có dấu thời gian (measurements + timestamps)
- Xử lý hàng nghìn transactions/giây, hàng nghìn tỷ records/ngày
- **Tiered storage**: Dữ liệu gần đây → in-memory; dữ liệu cũ → magnetic
- Built-in time-series analytics: smoothing, interpolation, approximation
- Tích hợp với Grafana, IoT SiteWise, Kinesis

Use cases: IoT sensors, application metrics, DevOps telemetry, financial market data

Mặc dù DynamoDB có thể lưu time-series data, Timestream tối ưu hơn nhiều cho use case này.',
 'single'),

('d2000000-0000-0000-0000-000000000015',
 'c2000000-0000-0000-0000-000000000001',
 'Aurora Serverless v2 khác Aurora Provisioned ở điểm nào?',
 '[{"key":"A","text":"Serverless v2 chỉ hỗ trợ MySQL còn Provisioned hỗ trợ cả MySQL và PostgreSQL"},{"key":"B","text":"Serverless v2 tự động scale capacity (ACU) lên xuống theo demand, tính phí theo ACU thực sự dùng"},{"key":"C","text":"Serverless v2 không hỗ trợ Multi-AZ"},{"key":"D","text":"Serverless v2 luôn đắt hơn Aurora Provisioned"}]',
 'B', 1, 15,
 '**Aurora Serverless v2**:
- **Auto-scales** capacity từ 0.5 ACU → 128 ACU trong vài giây
- Tính phí theo **ACU-hours** thực sự dùng (không trả cho capacity nhàn rỗi)
- Hỗ trợ: MySQL và PostgreSQL compatible
- Hỗ trợ Multi-AZ, Read Replicas, Global Database
- Phù hợp: workload không đều/unpredictable, dev/test, intermittent usage

**Aurora Provisioned**:
- Capacity cố định (chọn instance type), predictable cost
- Phù hợp: workload ổn định, steady-state

Serverless v2 cải thiện đáng kể so v1: scale nhanh hơn nhiều (100x), hỗ trợ đầy đủ tính năng Aurora.',
 'single');

-- ============================================================
-- EXAM 3 — Security, Management & Analytics
-- ============================================================
INSERT INTO quiz_exams.exams (id, title, description, time_limit, passing_score, created_by, is_published, tags, show_explanation, allow_retake)
VALUES (
  'c3000000-0000-0000-0000-000000000001',
  'AWS SAA - Security & Management',
  'Bảo mật (IAM, KMS, GuardDuty, WAF, Shield...), quản trị (CloudWatch, CloudTrail, Config, CloudFormation...) và phân tích dữ liệu (Athena, Kinesis, EMR, Glue...) của AWS.',
  35, 70,
  'a0000000-0000-0000-0000-000000000002',
  true,
  ARRAY['AWS','SAA','Security','Management','Analytics'],
  true, true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO quiz_exams.questions (id, exam_id, content, options, correct_answer, points, order_index, explanation, question_type) VALUES

('d3000000-0000-0000-0000-000000000001',
 'c3000000-0000-0000-0000-000000000001',
 'Ứng dụng chạy trên EC2 cần truy cập S3 bucket. Best practice nào nên áp dụng?',
 '[{"key":"A","text":"Lưu AWS Access Key/Secret vào biến môi trường (environment variable) của EC2"},{"key":"B","text":"Hardcode credentials trực tiếp vào source code"},{"key":"C","text":"Gán IAM Role cho EC2 instance với least-privilege policy"},{"key":"D","text":"Tạo IAM User riêng và copy credentials vào file ~/.aws/credentials trên EC2"}]',
 'C', 1, 1,
 '**Best practice**: Gán **IAM Role** cho EC2 instance.

- EC2 tự nhận **temporary credentials** từ Instance Metadata Service (IMDS) — tự động rotate
- **Không bao giờ** hardcode, lưu Access Key tĩnh vào EC2
- IAM Role Policy: áp dụng **Principle of Least Privilege** — chỉ cấp quyền tối thiểu cần thiết

Ví dụ policy tốt:
```json
{
  "Effect": "Allow",
  "Action": ["s3:GetObject", "s3:PutObject"],
  "Resource": "arn:aws:s3:::my-bucket/*"
}
```

Không dùng `s3:*` khi chỉ cần đọc/ghi.',
 'single'),

('d3000000-0000-0000-0000-000000000002',
 'c3000000-0000-0000-0000-000000000001',
 'Amazon Cognito cung cấp chức năng gì?',
 '[{"key":"A","text":"Quản lý IAM Users và Groups cho AWS Console"},{"key":"B","text":"Xác thực và phân quyền cho ứng dụng web/mobile, hỗ trợ social identity providers"},{"key":"C","text":"Mã hóa dữ liệu at rest cho S3 và EBS"},{"key":"D","text":"Giám sát và audit truy cập tài nguyên AWS"}]',
 'B', 1, 2,
 '**Amazon Cognito** gồm 2 thành phần:

**User Pools** (Authentication):
- Directory lưu user accounts cho app của bạn
- Sign-up, sign-in, forgot password
- Social login: Google, Facebook, Apple, Amazon
- Enterprise: SAML 2.0, OIDC (Active Directory, Okta)
- Phát **JWT tokens** (ID token, Access token, Refresh token)

**Identity Pools** (Authorization):
- Đổi JWT → AWS credentials (IAM temporary credentials)
- Truy cập trực tiếp S3, DynamoDB, API Gateway...
- Hỗ trợ unauthenticated (guest) users

Khác IAM: Cognito cho end-users của ứng dụng; IAM cho AWS admins/developers.',
 'single'),

('d3000000-0000-0000-0000-000000000003',
 'c3000000-0000-0000-0000-000000000001',
 'AWS KMS (Key Management Service) dùng để làm gì?',
 '[{"key":"A","text":"Tạo và quản lý SSL/TLS certificates"},{"key":"B","text":"Tạo, quản lý và kiểm soát việc sử dụng encryption keys"},{"key":"C","text":"Lưu trữ và rotate database passwords"},{"key":"D","text":"Phân tích security logs và phát hiện mối đe dọa"}]',
 'B', 1, 3,
 '**AWS KMS (Key Management Service)**:
- Tạo và quản lý **Customer Managed Keys (CMK)**
- Tích hợp với 100+ dịch vụ AWS: S3, EBS, RDS, Lambda, DynamoDB, CloudTrail...
- **Envelope encryption**: KMS mã hóa data key, data key mã hóa data thực tế
- Audit mọi key usage qua **CloudTrail**
- **Key types**: AWS managed keys (miễn phí), Customer managed keys ($1/key/tháng)

Khác **CloudHSM**: HSM cung cấp dedicated hardware security module, full control, FIPS 140-2 Level 3; KMS là shared managed service.
Khác **Secrets Manager**: Lưu và rotate secrets (passwords, API keys).',
 'single'),

('d3000000-0000-0000-0000-000000000004',
 'c3000000-0000-0000-0000-000000000001',
 'Amazon GuardDuty phân tích nguồn dữ liệu nào để phát hiện mối đe dọa? (Chọn 3)',
 '[{"key":"A","text":"VPC Flow Logs"},{"key":"B","text":"AWS CloudTrail Events"},{"key":"C","text":"Application source code"},{"key":"D","text":"DNS Logs"},{"key":"E","text":"EC2 CPU utilization metrics"}]',
 'A,B,D', 2, 4,
 '**Amazon GuardDuty** phân tích (không cần bạn enable thủ công):
- **VPC Flow Logs**: Phát hiện port scanning, unusual traffic, cryptocurrency mining
- **CloudTrail Management Events**: API calls bất thường, credential abuse, impossible travel
- **CloudTrail S3 Data Events**: Truy cập S3 đáng ngờ (data exfiltration)
- **DNS Logs**: Communication với known malicious domains/IPs
- **EKS Audit Logs, RDS Login Events** (tính năng mở rộng)

GuardDuty dùng **ML** + threat intelligence feeds (CrowdStrike, Proofpoint, AWS)

Phát hiện: cryptojacking, compromised credentials, recon attacks, trojan.
Không phân tích source code hay CPU metrics.',
 'multiple'),

('d3000000-0000-0000-0000-000000000005',
 'c3000000-0000-0000-0000-000000000001',
 'Sự khác biệt giữa Amazon Macie và Amazon Inspector là gì?',
 '[{"key":"A","text":"Macie bảo vệ EC2, Inspector bảo vệ S3"},{"key":"B","text":"Macie khám phá dữ liệu nhạy cảm trên S3 bằng ML, Inspector đánh giá lỗ hổng bảo mật EC2/ECR/Lambda"},{"key":"C","text":"Macie là firewall, Inspector là IDS/IPS"},{"key":"D","text":"Không có sự khác biệt, cả hai đều scan malware"}]',
 'B', 1, 5,
 '**Amazon Macie**:
- Dùng ML để **khám phá và bảo vệ dữ liệu nhạy cảm** trong S3
- Phát hiện PII: số CMND/CCCD, số thẻ tín dụng, tài khoản ngân hàng, email, số điện thoại
- Alert khi S3 bucket publicly accessible hoặc chứa sensitive data không được encrypt
- Hỗ trợ compliance: GDPR, HIPAA, PCI DSS

**Amazon Inspector**:
- **Tự động đánh giá security vulnerabilities** (CVEs) cho:
  - EC2 instances
  - ECR container images
  - Lambda functions
- Network reachability analysis
- Tích hợp với AWS Security Hub

Cả hai tự động, nhưng mục đích hoàn toàn khác: Macie = data privacy; Inspector = vulnerability assessment.',
 'single'),

('d3000000-0000-0000-0000-000000000006',
 'c3000000-0000-0000-0000-000000000001',
 'AWS Shield Advanced cung cấp thêm gì so với Shield Standard?',
 '[{"key":"A","text":"Cả hai giống hệt nhau, chỉ khác tên"},{"key":"B","text":"Shield Standard trả phí còn Shield Advanced miễn phí"},{"key":"C","text":"Shield Advanced cung cấp DDoS Response Team 24/7, cost protection và advanced Layer 7 mitigation"},{"key":"D","text":"Shield Advanced chỉ bảo vệ CloudFront còn Standard bảo vệ toàn bộ AWS"}]',
 'C', 1, 6,
 '**AWS Shield Standard** (miễn phí, tự động):
- Bảo vệ khỏi DDoS Layer 3/4 phổ biến (SYN flood, UDP reflection)
- Áp dụng cho tất cả tài nguyên AWS

**AWS Shield Advanced** ($3,000/tháng + data transfer fees):
- **DRT (DDoS Response Team)** hỗ trợ 24/7 — chuyên gia AWS hỗ trợ trong lúc bị tấn công
- **Cost protection**: Hoàn phí tài nguyên tăng đột biến do DDoS attack
- Advanced mitigation kể cả **Layer 7** (application layer)
- Real-time visibility và attack forensics
- Tích hợp với **AWS WAF** miễn phí
- **$150,000/năm** SLA cho response

Phù hợp: e-commerce, gaming, media streaming cần uptime cao.',
 'single'),

('d3000000-0000-0000-0000-000000000007',
 'c3000000-0000-0000-0000-000000000001',
 'AWS Secrets Manager khác AWS SSM Parameter Store ở điểm nào?',
 '[{"key":"A","text":"Parameter Store lưu secrets, Secrets Manager lưu configuration"},{"key":"B","text":"Secrets Manager hỗ trợ automatic rotation tích hợp với RDS/Aurora/Redshift/DocumentDB"},{"key":"C","text":"Parameter Store chỉ lưu text thuần, Secrets Manager lưu được binary data"},{"key":"D","text":"Không có sự khác biệt thực chất"}]',
 'B', 1, 7,
 '**AWS Secrets Manager**:
- Chuyên quản lý **secrets** (database passwords, API keys, OAuth tokens)
- **Automatic rotation** tích hợp với: RDS, Aurora, Redshift, DocumentDB — không cần viết code
- Rotation dùng Lambda function (managed bởi AWS)
- Cross-account access qua IAM
- Giá: $0.40/secret/tháng + $0.05/10,000 API calls

**SSM Parameter Store**:
- Lưu cả configuration values lẫn secrets (SecureString với KMS)
- **Không có** built-in automatic rotation
- **Standard tier miễn phí** (max 10,000 params, 4KB/param)
- Advanced tier: $0.05/param/tháng

**Rule of thumb**: Cần auto-rotation → Secrets Manager; config management/non-sensitive data → Parameter Store.',
 'single'),

('d3000000-0000-0000-0000-000000000008',
 'c3000000-0000-0000-0000-000000000001',
 'Amazon CloudWatch có thể làm những việc nào? (Chọn 3)',
 '[{"key":"A","text":"Thu thập và theo dõi metrics từ dịch vụ AWS và custom sources"},{"key":"B","text":"Tạo alarms và gửi notifications qua SNS"},{"key":"C","text":"Tự động patch và update EC2 instances"},{"key":"D","text":"Thu thập, lưu trữ và query application logs"},{"key":"E","text":"Scan vulnerabilities trong container images"}]',
 'A,B,D', 2, 8,
 '**Amazon CloudWatch** là dịch vụ observability toàn diện:

- **Metrics**: Thu thập từ 70+ AWS services + custom metrics từ application
- **Alarms**: Trigger khi metric vượt ngưỡng → gửi SNS, trigger Auto Scaling, Lambda
- **Logs**: CloudWatch Logs thu thập từ EC2, Lambda, ECS, API Gateway, RDS...
  - Log Insights: Query logs bằng query language riêng
- **Events/EventBridge**: Scheduled jobs, event-driven automation
- **Container Insights**: ECS/EKS performance monitoring
- **Dashboards**: Visualize metrics

**Patch Manager** → AWS Systems Manager (SSM)
**Container vulnerability scanning** → Amazon Inspector',
 'multiple'),

('d3000000-0000-0000-0000-000000000009',
 'c3000000-0000-0000-0000-000000000001',
 'AWS CloudTrail ghi lại những gì?',
 '[{"key":"A","text":"CPU và memory usage của EC2 instances"},{"key":"B","text":"Tất cả API calls đến AWS services: ai gọi, action gì, từ đâu, lúc nào, kết quả ra sao"},{"key":"C","text":"Network packet data trong VPC"},{"key":"D","text":"Application-level logs từ code của ứng dụng"}]',
 'B', 1, 9,
 '**AWS CloudTrail** ghi lại **API activity** trong AWS account:

- **WHO**: IAM User/Role nào thực hiện
- **WHAT**: API action gì (e.g., `s3:CreateBucket`, `ec2:TerminateInstances`)
- **WHEN**: Timestamp chính xác
- **WHERE**: Source IP address
- **RESULT**: Success hay AccessDenied

Lưu vào S3, có thể query bằng **Athena**.
Tích hợp với **CloudWatch Logs**, **EventBridge**.

Quan trọng cho: **audit**, **compliance** (SOC, PCI DSS, HIPAA), điều tra security incidents.

Khác CloudWatch Logs: CloudTrail = AWS API calls; CloudWatch = application/system/service logs.',
 'single'),

('d3000000-0000-0000-0000-000000000010',
 'c3000000-0000-0000-0000-000000000001',
 'AWS CloudFormation là gì?',
 '[{"key":"A","text":"Dịch vụ monitoring hiệu năng ứng dụng"},{"key":"B","text":"Infrastructure as Code — định nghĩa và provision AWS resources bằng template YAML/JSON"},{"key":"C","text":"Managed CI/CD pipeline service"},{"key":"D","text":"Private container image registry"}]',
 'B', 1, 10,
 '**AWS CloudFormation** là **Infrastructure as Code (IaC)** service:

- Định nghĩa infrastructure trong **YAML hoặc JSON template**
- CloudFormation tự động create, update, delete resources đúng thứ tự phụ thuộc
- **Stack**: Tập hợp resources quản lý cùng nhau như một đơn vị
- **Change Sets**: Preview thay đổi trước khi apply
- **Drift Detection**: Phát hiện khi resource bị sửa thủ công ngoài CloudFormation
- **Rollback**: Tự động rollback về state trước nếu deployment fail

Alternative: **AWS CDK** (Cloud Development Kit) — viết bằng TypeScript/Python/Java rồi synthesize ra CloudFormation template.',
 'single'),

('d3000000-0000-0000-0000-000000000011',
 'c3000000-0000-0000-0000-000000000001',
 'Amazon Athena dùng để làm gì?',
 '[{"key":"A","text":"Chạy Spark và Hadoop jobs trên managed EC2 cluster"},{"key":"B","text":"Query dữ liệu trực tiếp trên S3 bằng standard SQL mà không cần ETL hay provision server"},{"key":"C","text":"Real-time stream processing với sub-second latency"},{"key":"D","text":"Machine learning model training và deployment"}]',
 'B', 1, 11,
 '**Amazon Athena** là **serverless interactive query service**:

- Query dữ liệu trực tiếp trên **S3** bằng ANSI SQL
- **Không cần**: ETL pipeline, load data, provision servers
- Hỗ trợ: CSV, JSON, ORC, Avro, **Parquet** (compressed)
- Tính phí theo **data scanned** ($5/TB) — dùng Parquet/ORC + partitioning để tiết kiệm 70-90%
- Tích hợp với **AWS Glue Data Catalog** (schema management)

Phù hợp cho:
- Ad-hoc log analysis (CloudTrail, ALB, VPC Flow Logs, CloudFront)
- One-time queries không cần cụm server thường trực
- BI tools như QuickSight',
 'single'),

('d3000000-0000-0000-0000-000000000012',
 'c3000000-0000-0000-0000-000000000001',
 'Kinesis Data Streams khác Kinesis Data Firehose ở điểm nào?',
 '[{"key":"A","text":"Data Streams chỉ nhận từ Kinesis Producer Library còn Firehose nhận từ nhiều nguồn hơn"},{"key":"B","text":"Data Streams cho phép xử lý real-time tùy chỉnh, Firehose là fully managed near-real-time delivery đến S3/Redshift/OpenSearch"},{"key":"C","text":"Firehose lưu data lâu hơn Data Streams"},{"key":"D","text":"Data Streams miễn phí còn Firehose trả phí"}]',
 'B', 1, 12,
 '**Kinesis Data Streams**:
- **Real-time**: latency ~70ms
- Cần viết consumer code (KCL, Lambda, Apache Flink)
- Lưu data 1-365 ngày (configurable retention)
- Bạn quản lý shards và manual scaling
- Nhiều consumers cùng đọc 1 stream
- Phù hợp: custom real-time processing, event sourcing

**Kinesis Data Firehose**:
- **Fully managed** near-real-time (buffering 60-900 giây)
- Không cần viết consumer code
- Deliver thẳng đến: **S3, Redshift, OpenSearch, Splunk, HTTP endpoints**
- Transform data với Lambda trước khi deliver
- Auto-scale, không quản lý shards
- Phù hợp: log/metric ingestion vào data lake, không cần xử lý phức tạp',
 'single'),

('d3000000-0000-0000-0000-000000000013',
 'c3000000-0000-0000-0000-000000000001',
 'AWS Glue chủ yếu dùng để làm gì?',
 '[{"key":"A","text":"Quản lý container images và repositories"},{"key":"B","text":"ETL (Extract, Transform, Load) serverless và Data Catalog cho data lake"},{"key":"C","text":"Real-time stream processing"},{"key":"D","text":"Migrate database schema và data từ on-premises lên AWS"}]',
 'B', 1, 13,
 '**AWS Glue** là fully managed **ETL + Data Catalog** service:

**Data Catalog**: Metadata repository trung tâm
- Lưu schema, tables, partitions
- Được dùng bởi Athena, EMR, Redshift Spectrum tự động

**ETL Jobs**: Serverless Apache Spark jobs
- Transform và enrich data
- Tự động generate ETL code (Python/Scala)

**Glue Crawlers**: Tự động scan data sources (S3, RDS, DynamoDB) → cập nhật Catalog

**Glue Studio**: Visual drag-and-drop ETL designer
**Glue DataBrew**: No-code data preparation

Workflow điển hình: Crawler scan S3 → Athena query → Glue ETL → load vào Redshift.',
 'single'),

('d3000000-0000-0000-0000-000000000014',
 'c3000000-0000-0000-0000-000000000001',
 'Amazon EMR (Elastic MapReduce) dùng để làm gì?',
 '[{"key":"A","text":"Quản lý email queue và messaging"},{"key":"B","text":"Managed Big Data cluster chạy Spark, Hadoop, Hive, Presto trên EC2/EKS"},{"key":"C","text":"Business Intelligence (BI) và data visualization"},{"key":"D","text":"Serverless SQL query trực tiếp trên S3"}]',
 'B', 1, 14,
 '**Amazon EMR (Elastic MapReduce)** là managed cluster platform cho **Big Data**:

- Chạy: **Apache Spark**, Hadoop, Hive, HBase, Presto, Flink, Pig
- Tự động provision và configure EC2 cluster
- **EMR Serverless**: Chạy Spark/Hive mà không cần manage cluster
- **EMR on EKS**: Chạy Spark jobs trên EKS cluster hiện có

Use cases:
- Log processing và analysis
- Large-scale ETL
- Machine learning (MLlib)
- Genomics/bioinformatics
- Financial risk modeling

Khác Athena: EMR cho complex, long-running processing cần custom code; Athena cho SQL queries đơn giản, serverless.',
 'single'),

('d3000000-0000-0000-0000-000000000015',
 'c3000000-0000-0000-0000-000000000001',
 'Dịch vụ nào bảo vệ ứng dụng web khỏi SQL injection và XSS? (Chọn 2)',
 '[{"key":"A","text":"AWS WAF (Web Application Firewall)"},{"key":"B","text":"AWS Shield Standard"},{"key":"C","text":"Amazon GuardDuty"},{"key":"D","text":"AWS Network Firewall"},{"key":"E","text":"AWS WAF được quản lý tập trung qua AWS Firewall Manager"}]',
 'A,E', 2, 15,
 '**AWS WAF (Web Application Firewall)**:
- Bảo vệ khỏi **Layer 7 attacks**: SQL injection, XSS, CSRF, bot attacks
- Web ACL rules: IP-based, rate-based, regex patterns
- **Managed Rule Groups**: OWASP Top 10, AWS Managed Rules, vendor rules (Cloudflare, F5)
- Gắn vào: CloudFront, ALB, API Gateway, AppSync, Cognito

**AWS Firewall Manager + WAF**:
- Quản lý WAF rules tập trung cho **nhiều accounts** trong AWS Organizations
- Đảm bảo compliance — tất cả accounts phải có WAF rules đúng
- Tự động deploy WAF policies cho resources mới

**Shield**: DDoS Layer 3/4 protection — không lọc SQL injection
**GuardDuty**: Threat detection — không filter web traffic
**Network Firewall**: VPC-level stateful/stateless packet inspection — không phân tích HTTP payload ở application level',
 'multiple');

COMMIT;
