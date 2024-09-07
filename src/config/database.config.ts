import { DataSource } from 'typeorm';
import { Transaction } from '../entities/Transaction';
import { Refund } from '../entities/Refund';
import { AuditLog } from '../entities/AuditLog'; // Import the AuditLog entity

// Main database configuration
const mainDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  synchronize: true, // auto-create database schema
  logging: true,
  entities: [Transaction, Refund],
});

// Audit log database configuration
const auditLogDataSource = new DataSource({
  type: 'mysql',
  host: process.env.AUDIT_DB_HOST,
  port: Number(process.env.AUDIT_DB_PORT),
  username: process.env.AUDIT_DB_USER,
  password: process.env.AUDIT_DB_PASS,
  database: process.env.AUDIT_DB_NAME,
  synchronize: true, // auto-create database schema
  logging: true,
  entities: [AuditLog],
});

// Exporting data sources
export { mainDataSource, auditLogDataSource };
