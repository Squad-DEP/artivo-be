#!/usr/bin/env ts-node
/**
 * Database Migration Runner
 * Runs all .up.sql files in order
 * Usage: ts-node src/scripts/migrate.ts [up|down|reset]
 */

import 'dotenv/config';
import { Sequelize } from 'sequelize';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const args = process.argv.slice(2);
const command = args[0] || 'up';

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

const migrationsDir = join(__dirname, '../database/migrations');

async function runMigrations() {
    try {
        console.log('Connecting to database...');
        await sequelize.authenticate();
        console.log('Connected!\n');

        if (command === 'down' || command === 'reset') {
            console.log('🔻 Running DOWN migrations...');
            const dropFile = join(migrationsDir, '000-drop-all.down.sql');
            if (existsSync(dropFile)) {
                console.log('   Dropping all tables...');
                const sql = readFileSync(dropFile, 'utf8');
                await sequelize.query(sql);
                console.log('   ✅ All tables dropped\n');
            }
        }

        if (command === 'up' || command === 'reset') {
            console.log('🔺 Running UP migrations...');
            
            // Get all .up.sql files (excluding seed files) and sort them
            const files = readdirSync(migrationsDir)
                .filter(f => f.endsWith('.up.sql') && !f.includes('seed'))
                .sort();

            for (const file of files) {
                console.log(`   Running: ${file}`);
                const filePath = join(migrationsDir, file);
                const sql = readFileSync(filePath, 'utf8');
                
                try {
                    await sequelize.query(sql);
                    console.log(`   ✅ ${file}`);
                } catch (error: any) {
                    console.error(`   ❌ ${file}: ${error.message}`);
                    throw error;
                }
            }
            
            console.log('\n✅ All migrations completed successfully!');

            // Run seed files if reset
            if (command === 'reset') {
                console.log('\n🌱 Running SEED files...');
                const seedFiles = readdirSync(migrationsDir)
                    .filter(f => f.includes('seed') && f.endsWith('.sql'))
                    .sort();

                for (const file of seedFiles) {
                    console.log(`   Running: ${file}`);
                    const filePath = join(migrationsDir, file);
                    const sql = readFileSync(filePath, 'utf8');
                    
                    try {
                        await sequelize.query(sql);
                        console.log(`   ✅ ${file}`);
                    } catch (error: any) {
                        console.error(`   ❌ ${file}: ${error.message}`);
                        throw error;
                    }
                }
                
                console.log('\n✅ Database seeded successfully!');
            }
        }

        process.exit(0);
    } catch (error: any) {
        console.error('\n❌ Migration failed:', error.message);
        process.exit(1);
    }
}

runMigrations();
