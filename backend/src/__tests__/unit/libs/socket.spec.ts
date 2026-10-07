var mockSocketInstance: any;
var mockMiddleware: any;

jest.mock("socket.io", () => ({
  Server: jest.fn().mockImplementation(() => {
    mockSocketInstance = {
      adapter: jest.fn(),
      use: jest.fn(callback => {
        mockMiddleware = callback;
      }),
      on: jest.fn()
    };

    return mockSocketInstance;
  })
}));

jest.mock("socket.io-redis", () => jest.fn(() => "redis-adapter"));
jest.mock("../../../libs/decodeTokenSocket", () => jest.fn());
jest.mock("../../../models/User", () => ({ findByPk: jest.fn() }));
jest.mock("../../../libs/socketChat/Chat", () => ({ register: jest.fn() }));
jest.mock("../../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

import { Server as SocketIOServer } from "socket.io";
import socketRedis from "socket.io-redis";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import User from "../../../models/User";
import { initIO } from "../../../libs/socket";

describe("libs/socket initIO authentication middleware", () => {
  const makeSocket = () =>
    ({
      id: "socket-1",
      handshake: {
        auth: {
          token: "valid-token",
          original: "value"
        }
      },
      emit: jest.fn(),
      join: jest.fn(),
      on: jest.fn()
    } as any);

  beforeEach(() => {
    jest.clearAllMocks();
    mockSocketInstance = undefined;
    mockMiddleware = undefined;
  });

  it("authenticates a valid token and calls next only once", async () => {
    const user = { id: 123, name: "Test User" };
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 123,
        tenantId: 456,
        profile: "admin"
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    initIO({} as any);

    const socket = makeSocket();
    const next = jest.fn();
    await mockMiddleware(socket, next);

    expect(SocketIOServer).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        cors: { origin: "*" },
        pingTimeout: 180000,
        pingInterval: 60000
      })
    );
    expect(socketRedis).toHaveBeenCalled();
    expect(mockSocketInstance.adapter).toHaveBeenCalledWith("redis-adapter");
    expect(User.findByPk).toHaveBeenCalledWith(
      123,
      expect.objectContaining({
        attributes: expect.arrayContaining(["id", "tenantId", "email"])
      })
    );
    expect(socket.handshake.auth).toMatchObject({
      original: "value",
      id: "123",
      tenantId: "456",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects an invalid token without loading a user", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        tenantId: 0,
        profile: ""
      }
    });

    initIO({} as any);

    const next = jest.fn();
    await mockMiddleware(makeSocket(), next);

    expect(User.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });
});
