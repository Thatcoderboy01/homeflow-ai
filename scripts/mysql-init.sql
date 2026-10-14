-- Creates the test database and grants the app user access (runs once on first container start).
CREATE DATABASE IF NOT EXISTS homeflow_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON homeflow_test.* TO 'homeflow'@'%';
GRANT ALL PRIVILEGES ON homeflow.* TO 'homeflow'@'%';
-- Prisma migrate dev needs to create a shadow database:
GRANT CREATE, ALTER, DROP, REFERENCES, INDEX, SELECT, INSERT, UPDATE, DELETE ON *.* TO 'homeflow'@'%';
FLUSH PRIVILEGES;
