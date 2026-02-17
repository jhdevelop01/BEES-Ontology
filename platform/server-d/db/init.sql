-- BEES Platform PostgreSQL Schema
-- 초기화 스크립트 (docker-entrypoint-initdb.d에서 자동 실행)

-- 사용자 관리
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'viewer',
    department VARCHAR(100),
    password_hash VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

-- 장비 메타데이터 (온톨로지 보완)
CREATE TABLE equipment_metadata (
    id SERIAL PRIMARY KEY,
    ontology_id VARCHAR(255) UNIQUE NOT NULL,
    manufacturer VARCHAR(200),
    model VARCHAR(200),
    serial_number VARCHAR(100),
    install_date DATE,
    warranty_expiry DATE,
    total_runtime_hours DOUBLE PRECISION DEFAULT 0,
    last_maintenance_date DATE,
    next_maintenance_date DATE,
    maintenance_interval_days INTEGER,
    notes TEXT
);

-- 유지보수 작업 주문
CREATE TABLE work_orders (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER REFERENCES equipment_metadata(id),
    title VARCHAR(300) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'requested',
    assigned_to INTEGER REFERENCES users(id),
    requested_by INTEGER REFERENCES users(id),
    estimated_hours DOUBLE PRECISION,
    actual_hours DOUBLE PRECISION,
    parts_used JSONB,
    cost DECIMAL(12,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    notes TEXT
);

-- 알람 이력
CREATE TABLE alarm_history (
    id SERIAL PRIMARY KEY,
    equipment_id VARCHAR(255) NOT NULL,
    alarm_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    threshold_value DOUBLE PRECISION,
    actual_value DOUBLE PRECISION,
    onset_at TIMESTAMPTZ NOT NULL,
    cleared_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by INTEGER REFERENCES users(id),
    suppressed BOOLEAN DEFAULT false,
    notes TEXT
);

-- 감사 로그
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    target_equipment VARCHAR(255),
    old_value TEXT,
    new_value TEXT,
    source VARCHAR(50),
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 스케줄 관리
CREATE TABLE schedules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    equipment_ids TEXT[] NOT NULL,
    schedule_type VARCHAR(20),
    schedule_data JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_alarm_history_equipment ON alarm_history(equipment_id);
CREATE INDEX idx_alarm_history_severity ON alarm_history(severity);
CREATE INDEX idx_alarm_history_onset ON alarm_history(onset_at DESC);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX idx_work_orders_status ON work_orders(status);
CREATE INDEX idx_work_orders_equipment ON work_orders(equipment_id);

-- 알림 이력 (Email/Slack)
CREATE TABLE IF NOT EXISTS notification_log (
    id SERIAL PRIMARY KEY,
    channel VARCHAR(20) NOT NULL,
    alarm_equipment VARCHAR(255),
    alarm_severity VARCHAR(20),
    alarm_type VARCHAR(100),
    recipient VARCHAR(255),
    status VARCHAR(20) NOT NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_log_created ON notification_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_log_channel ON notification_log(channel);

-- 기본 계정 (비밀번호: admin123 / viewer123)
INSERT INTO users (email, name, role, department, password_hash)
VALUES
  ('admin@bees.dev', '시스템 관리자', 'admin', 'FM팀', '$2b$12$axImNkZOfxnp.dksl.FMC..T4GPVWmY1.lE2q1Eiq2Xb17jE.ytpy'),
  ('viewer@bees.dev', '일반 사용자', 'viewer', 'FM팀', '$2b$12$CPKUvf5Ka2tGDnhljApakuHhfrx34J5cULmiuG7lRK.Jw.RTMH9Zm');
