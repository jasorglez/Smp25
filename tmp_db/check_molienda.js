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
      database: "production", // It's probably in the production database
      options: { encrypt: true, trustServerCertificate: true }
    });

    const checkQuery = `SELECT * FROM Molienda_details WHERE id_requisition IN (727)`;
    const checkResult = await pool.request().query(checkQuery);
    console.table(checkResult.recordset);
    
    await pool.close();
  } catch (err) {
    console.error("Error SQL:", err.message);
  }
}

run();
