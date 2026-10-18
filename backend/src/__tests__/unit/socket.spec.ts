var mockIo: any;
var mockMiddleware: any;

jest.mock("socket.io", () => ({
  Server: jest.fn().mockImplementation(() => {
    mockIo = {
      adapter: jest.fn(),
      use: jest.fn(middleware => {
        mockMiddleware = middleware;
        return mockIo;
      }),
      on: jest.fn(() => mockIo)
    };

    return mockIo;
  })
}));

jest.mock("socket.io-redis", () => jest.fn(() => "redis-adapter"));
jest.mock("../../libs/decodeTokenSocket", () => jest.fn());
jest.mock("../../models/User", () => ({
  findByPk: jest.fn()
}));
jest.mock("../../libs/socketChat/Chat", () => ({
  register: jest.fn()
}));
jest.mock("../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn()
  }
}));

import decodeTokenSocket from "../../libs/decodeTokenSocket";
import User from "../../models/User";
import { initIO } from "../../libs/socket";

describe("socket authentication middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIo = undefined;
    mockMiddleware = undefined;
  });

  it("accepts a valid token without also reporting an authentication error", async () => {
    const user = { id: 7, tenantId: 42, name: "Agent" };
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 7,
        tenantId: 42,
        profile: "admin"
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    initIO({} as any);

    const socket = {
      id: "socket-1",
      handshake: {
        auth: {
          token: "valid-token",
          keep: "value"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    await mockMiddleware(socket, next);

    expect(User.findByPk).toHaveBeenCalledWith(7, {
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
    expect(socket.handshake.auth).toMatchObject({
      token: "valid-token",
      keep: "value",
      id: "7",
      tenantId: "42",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects an invalid token before loading a user", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        tenantId: 0,
        profile: ""
      }
    });

    initIO({} as any);

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

    await mockMiddleware(socket, next);

    expect(User.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });
});
