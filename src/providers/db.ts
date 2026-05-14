import { Sequelize } from 'sequelize-typescript';

if (process.env.NODE_ENV === 'test') {
    process.env.DB_USERNAME = 'root';
    process.env.DB_PASSWORD = 'supersecret';
    process.env.DB_DATABASE = 'test';
}

const dialect = (process.env.DB_DIALECT as 'mysql' | 'postgres') || 'postgres';

const sequelize = new Sequelize({
    username: process.env.DB_USERNAME as string,
    password: process.env.DB_PASSWORD as string,
    database: process.env.DB_DATABASE as string,
    host: process.env.DB_HOST as string,
    port: Number(process.env.DB_PORT) || (dialect === 'postgres' ? 5432 : 3306),
    dialect,
    logging: false,
    dialectOptions: dialect === 'postgres' ? {
        ssl: {
            require: true,
            rejectUnauthorized: false, // Supabase uses SSL
        },
    } : undefined,
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
    },
});
sequelize.authenticate().then(() => (process.env.NODE_ENV !== 'test') ? console.log(`* DB Connected (${process.env.NODE_ENV})`) : null);

export default sequelize;
export { sequelize };
