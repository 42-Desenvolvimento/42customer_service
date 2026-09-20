import { exec } from "child_process";
import { Sequelize } from "sequelize";
import waitForPostgresConnection from "../../../app/awaitPostgresConnection";

jest.mock("child_process", () => ({
  exec: jest.fn()
}));

jest.mock("sequelize", () => ({
  Sequelize: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

describe("waitForPostgresConnection", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const authenticate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = "production";
    authenticate.mockResolvedValue(undefined);
    (Sequelize as unknown as jest.Mock).mockImplementation(() => ({
      authenticate
    }));
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("does not treat migration stderr as fatal when the command succeeds", async () => {
    (exec as unknown as jest.Mock).mockImplementation((command, callback) => {
      callback(null, {
        stdout: "migrated",
        stderr: "sequelize warning"
      });
    });

    await expect(waitForPostgresConnection()).resolves.toBeUndefined();

    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(exec).toHaveBeenCalledWith(
      "npx sequelize db:migrate",
      expect.any(Function)
    );
  });

  it("fails fast when migrations fail after the database is reachable", async () => {
    const migrationError = new Error("migration failed");
    (exec as unknown as jest.Mock).mockImplementation((command, callback) => {
      callback(migrationError, "", "migration failed");
    });

    await expect(waitForPostgresConnection()).rejects.toThrow(
      "migration failed"
    );

    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(exec).toHaveBeenCalledTimes(1);
  });
});
