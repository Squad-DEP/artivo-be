#!/usr/bin/env ts-node
/**
 * Run any SQL file against the database
 * Usage: ts-node src/scripts/runSql.ts <path-to-sql-file>
 */

import 'dotenv/config';
import { Sequelize } from 'sequelize';
import { readFileSync, existsSync } from 'fs';

const args = process.argv.slice(2);

if (args.length === 0) {
    console.error('Usage: ts-node src/scripts/runSql.ts <path-to-sql-file>');
    process.exit(1);
}

const sqlFilePath = args[0];

if (!existsSync(sqlFilePath)) {
    console.error(`File not found: ${sqlFilePath}`);
    process.exit(1);
}

const sequelize = new Sequelize({
    username: process.env.DB_USERNAME as string,
    password: process.env.DB_PASSWORD as string,
    database: process.env.DB_DATABASE as string,
    host: process.env.DB_HOST as string,
    port: Number(process.env.DB_PORT) || 5432,
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    },
});

async function runSql() {
    try {
        console.log(`Reading SQL file: ${sqlFilePath}`);
        const sql = readFileSync(sqlFilePath, 'utf8');
        
        console.log('Connecting to database...');
        await sequelize.authenticate();
        console.log('Connected!');
        
        console.log('Executing SQL...');
        await sequelize.query(sql);
        
        console.log('✅ SQL executed successfully!');
        process.exit(0);
    } catch (error: any) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

runSql();
