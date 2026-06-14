import { Server as SocketIOServer } from "socket.io";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { initIO } from "../../../libs/socket";
import User from "../../../models/User";

let mockAuthMiddleware: any;

const mockIo = {
  adapter: jest.fn(),
  use: jest.fn((middleware: any) => {
    mockAuthMiddleware = middleware;
    return mockIo;
  }),
  on: jest.fn()
};

jest.mock("socket.io", () => ({
  Server: jest.fn(() => mockIo)
}));

jest.mock("socket.io-redis", () => jest.fn(() => "redis-adapter"));

jest.mock("../../../libs/decodeTokenSocket", () => jest.fn());

jest.mock("../../../models/User", () => ({
  findByPk: jest.fn()
}));

jest.mock("../../../libs/socketChat/Chat", () => ({
  register: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn()
  }
}));

const mockSocketIOServer = SocketIOServer as unknown as jest.Mock;
const mockDecodeTokenSocket = decodeTokenSocket as jest.Mock;
const mockUserFindByPk = User.findByPk as jest.Mock;

describe("socket initIO authentication middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthMiddleware = undefined;
  });

  const registerMiddleware = () => {
    const httpServer = {} as any;

    initIO(httpServer);

    expect(mockSocketIOServer).toHaveBeenCalledWith(
      httpServer,
      expect.objectContaining({
        cors: { origin: "*" },
        pingTimeout: 180000,
        pingInterval: 60000
      })
    );
    expect(mockIo.adapter).toHaveBeenCalledWith("redis-adapter");
    expect(mockIo.use).toHaveBeenCalledTimes(1);
    expect(mockAuthMiddleware).toEqual(expect.any(Function));
  };

  it("accepts a valid token, enriches socket auth and calls next without error", async () => {
    const user = { id: 99, name: "Agent" };
    const socket = {
      id: "socket-1",
      handshake: {
        auth: {
          token: "valid-token",
          keep: "existing"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    mockDecodeTokenSocket.mockReturnValue({
      isValid: true,
      data: {
        id: 99,
        profile: "admin",
        tenantId: 8
      }
    });
    mockUserFindByPk.mockResolvedValue(user);

    registerMiddleware();
    await mockAuthMiddleware(socket, next);

    expect(mockDecodeTokenSocket).toHaveBeenCalledWith("valid-token");
    expect(mockUserFindByPk).toHaveBeenCalledWith(99, {
      attributes: [
        "id",
        "tenantId",
        "name",
        "email",
        "profile",
        "status",
        "lastLogin",
        "lastOnline"
      ]
    });
    expect(socket.handshake.auth).toEqual({
      token: "valid-token",
      keep: "existing",
      id: "99",
      profile: "admin",
      tenantId: "8",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]).toHaveLength(0);
  });

  it("rejects an invalid token without loading a user", async () => {
    const socket = {
      id: "socket-2",
      handshake: {
        auth: {
          token: "invalid-token"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    mockDecodeTokenSocket.mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    registerMiddleware();
    await mockAuthMiddleware(socket, next);

    expect(mockUserFindByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });
});
