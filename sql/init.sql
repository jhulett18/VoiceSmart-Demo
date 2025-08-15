-- VoiceSmart Demo Database Schema
-- This file initializes the database with required tables and RLS policies

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable Row Level Security
ALTER DATABASE voicesmart SET row_security = on;

-- ===================================
-- TENANTS & USERS
-- ===================================

-- Tenants table for multi-tenancy
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    business_type VARCHAR(50) NOT NULL, -- 'dental', 'auto', 'fitness'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    settings JSONB DEFAULT '{}'::jsonb
);

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(50),
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'customer', -- 'customer', 'agent', 'admin'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ===================================
-- CONVERSATIONS & SESSIONS
-- ===================================

-- Conversations table
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'completed', 'archived'
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    summary TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table for conversation turns
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    is_voice BOOLEAN DEFAULT false,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processing_time_ms INTEGER,
    token_count INTEGER,
    cost_cents INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ===================================
-- INTEGRATIONS & AUDIT
-- ===================================

-- Integration calls audit log
CREATE TABLE integration_calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    integration_type VARCHAR(100) NOT NULL, -- 'calendar', 'crm', 'payments'
    method VARCHAR(20) NOT NULL, -- 'GET', 'POST', 'PUT', 'DELETE'
    endpoint VARCHAR(500) NOT NULL,
    request_data JSONB,
    response_data JSONB,
    status_code INTEGER,
    processing_time_ms INTEGER,
    idempotency_key VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    success BOOLEAN GENERATED ALWAYS AS (status_code >= 200 AND status_code < 300) STORED
);

-- Cost tracking table
CREATE TABLE cost_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    service VARCHAR(100) NOT NULL, -- 'openai', 'calendar', 'storage'
    operation VARCHAR(100) NOT NULL, -- 'chat_completion', 'embedding', 'api_call'
    quantity INTEGER NOT NULL,
    cost_cents INTEGER NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, date, service, operation)
);

-- ===================================
-- VECTOR EMBEDDINGS METADATA
-- ===================================

-- Documents table for RAG
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    source_url VARCHAR(1000),
    document_type VARCHAR(100), -- 'faq', 'policy', 'procedure'
    chunk_count INTEGER DEFAULT 0,
    is_indexed BOOLEAN DEFAULT false,
    indexed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Document chunks for vector search
CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    vector_id VARCHAR(255), -- Qdrant point ID
    token_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(document_id, chunk_index)
);

-- User memories for long-term context
CREATE TABLE user_memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    memory_type VARCHAR(100) NOT NULL, -- 'preference', 'fact', 'relationship'
    content TEXT NOT NULL,
    confidence DECIMAL(3,2) DEFAULT 0.5, -- 0.0 to 1.0
    vector_id VARCHAR(255), -- Qdrant point ID
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    access_count INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ===================================
-- INDEXES FOR PERFORMANCE
-- ===================================

-- Conversation indexes
CREATE INDEX idx_conversations_tenant_id ON conversations(tenant_id);
CREATE INDEX idx_conversations_session_id ON conversations(session_id);
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_started_at ON conversations(started_at);

-- Message indexes
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_tenant_id ON messages(tenant_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp);
CREATE INDEX idx_messages_type ON messages(type);

-- Integration calls indexes
CREATE INDEX idx_integration_calls_tenant_id ON integration_calls(tenant_id);
CREATE INDEX idx_integration_calls_conversation_id ON integration_calls(conversation_id);
CREATE INDEX idx_integration_calls_integration_type ON integration_calls(integration_type);
CREATE INDEX idx_integration_calls_created_at ON integration_calls(created_at);
CREATE INDEX idx_integration_calls_idempotency_key ON integration_calls(idempotency_key);

-- Cost tracking indexes
CREATE INDEX idx_cost_tracking_tenant_id ON cost_tracking(tenant_id);
CREATE INDEX idx_cost_tracking_date ON cost_tracking(date);
CREATE INDEX idx_cost_tracking_service ON cost_tracking(service);

-- Document indexes
CREATE INDEX idx_documents_tenant_id ON documents(tenant_id);
CREATE INDEX idx_documents_is_indexed ON documents(is_indexed);
CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX idx_document_chunks_tenant_id ON document_chunks(tenant_id);

-- User memory indexes
CREATE INDEX idx_user_memories_tenant_id ON user_memories(tenant_id);
CREATE INDEX idx_user_memories_user_id ON user_memories(user_id);
CREATE INDEX idx_user_memories_memory_type ON user_memories(memory_type);
CREATE INDEX idx_user_memories_last_accessed ON user_memories(last_accessed);

-- ===================================
-- ROW LEVEL SECURITY POLICIES
-- ===================================

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memories ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policies (using current_setting for tenant_id)
CREATE POLICY tenant_isolation_tenants ON tenants
    FOR ALL USING (id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_users ON users
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_conversations ON conversations
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_messages ON messages
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_integration_calls ON integration_calls
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_cost_tracking ON cost_tracking
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_documents ON documents
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_document_chunks ON document_chunks
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_user_memories ON user_memories
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ===================================
-- FUNCTIONS & TRIGGERS
-- ===================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_memories_updated_at BEFORE UPDATE ON user_memories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================================
-- SAMPLE DATA FOR DEMO
-- ===================================

-- Insert demo tenants
INSERT INTO tenants (id, name, business_type, settings) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'BrightSmile Dental Clinic', 'dental', '{"phone": "(555) 123-SMILE", "hours": "Mon-Fri 8AM-6PM, Sat 9AM-3PM"}'),
    ('550e8400-e29b-41d4-a716-446655440002', 'ProFix Auto Repair', 'auto', '{"phone": "(555) 456-AUTO", "hours": "Mon-Fri 7AM-7PM, Sat 8AM-4PM"}'),
    ('550e8400-e29b-41d4-a716-446655440003', 'PulsePoint Fitness Gym', 'fitness', '{"phone": "(555) 789-PULSE", "hours": "Mon-Fri 5AM-11PM, Weekends 6AM-10PM"}');

-- Insert demo documents for each business
INSERT INTO documents (tenant_id, title, content, document_type, is_indexed) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'Dental Services FAQ', 'We offer routine cleanings, fillings, root canals, cosmetic dentistry, and emergency care. Most insurance plans are accepted including Blue Cross, Aetna, Cigna, and Delta Dental.', 'faq', true),
    ('550e8400-e29b-41d4-a716-446655440002', 'Auto Repair Services', 'Our services include oil changes, brake repair, engine diagnostics, tire service, transmission repair, and general maintenance. We provide a 12-month/12,000-mile warranty on all repairs.', 'faq', true),
    ('550e8400-e29b-41d4-a716-446655440003', 'Fitness Programs', 'We offer personal training, group classes including yoga, spin, HIIT, pilates, strength training. Memberships include monthly, annual with discounts, day passes, and student discounts.', 'faq', true);

-- Create a service role for bypassing RLS (for API operations)
-- This user will be used by the application to manage tenant data
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role;
    END IF;
END
$$;

-- Grant necessary permissions to service_role
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Allow service_role to bypass RLS
ALTER ROLE service_role SET row_security = off;