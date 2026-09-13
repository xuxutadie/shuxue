-- 应用使用专属普通账号，不持有数据库超级管理员权限。
\getenv app_password MATH_DB_PASSWORD
CREATE ROLE math_app WITH LOGIN PASSWORD :'app_password';
ALTER DATABASE math_lab OWNER TO math_app;
ALTER SCHEMA public OWNER TO math_app;
