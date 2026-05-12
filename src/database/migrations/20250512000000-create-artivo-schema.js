const fs = require('fs');
const path = require('path');

module.exports = {
    up: async (queryInterface) => {
        const sql = fs.readFileSync(
            path.join(__dirname, '../sql/setup-one.up.sql'),
            'utf8'
        );
        return queryInterface.sequelize.query(sql);
    },

    down: async (queryInterface) => {
        // Drop tables in reverse order
        await queryInterface.sequelize.query('DROP TABLE IF EXISTS payment_logs CASCADE;');
        await queryInterface.sequelize.query('DROP TABLE IF EXISTS reputation_scores CASCADE;');
        await queryInterface.sequelize.query('DROP TABLE IF EXISTS reviews CASCADE;');
        await queryInterface.sequelize.query('DROP TABLE IF EXISTS jobs CASCADE;');
        await queryInterface.sequelize.query('DROP TABLE IF EXISTS job_requests CASCADE;');
        await queryInterface.sequelize.query('DROP TABLE IF EXISTS job_types CASCADE;');
        await queryInterface.sequelize.query('DROP TABLE IF EXISTS worker_profiles CASCADE;');
        await queryInterface.sequelize.query('DROP TABLE IF EXISTS users CASCADE;');
    },
};
