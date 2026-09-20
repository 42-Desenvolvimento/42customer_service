import { exec } from "child_process";
import { promisify } from "util";
import { Sequelize } from "sequelize";
import { logger } from "../utils/logger";

const execAsync = promisify(exec);

// eslint-disable-next-line
const dbConfig = require("../config/database");

const runMigrations = async (): Promise<void> => {
  logger.info("Iniciando a execução das migrations...");
  const { stdout, stderr } = await execAsync("npx sequelize db:migrate");
  logger.info(`Saída do comando: ${stdout}`);
  if (stderr) {
    logger.warn(`Aviso ao executar o comando: ${stderr}`);
  }
  logger.info("Migrations executadas com sucesso!");
};

// Função para aguardar a conexão com o PostgreSQL
const waitForPostgresConnection = async function () {
  const sequelize = new Sequelize(dbConfig);

  while (true) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await sequelize.authenticate();
      logger.info("Conexão com o PostgreSQL estabelecida com sucesso!");
      break;
    } catch (error) {
      logger.info(
        "Falha ao conectar ao PostgreSQL. Tentando novamente em 5 segundos..."
      );
      logger.info(error);
      // eslint-disable-next-line no-await-in-loop
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  if (process.env.NODE_ENV === "production") {
    await runMigrations();
  }
};

export default waitForPostgresConnection;
