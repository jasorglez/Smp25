import sql from "mssql";
import dotenv from "dotenv";

dotenv.config({ path: "/Users/alextellezvazquez/mcp-sqlserver/.env" });

async function run() {
  try {
    const pool = await sql.connect({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      server: process.env.DB_SERVER,
      port: Number(process.env.DB_PORT),
      database: "warehouses",
      options: { encrypt: true, trustServerCertificate: true }
    });

    const checkQuery = `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Detailsreqoc'`;
    const checkResult = await pool.request().query(checkQuery);
    console.log(checkResult.recordset.map(r => r.COLUMN_NAME).join(', '));
    
    await pool.close();
  } catch (err) {
    console.error("Error SQL:", err.message);
  }
}

run();
