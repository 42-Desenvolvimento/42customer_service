const mockAdapter = jest.fn();
const mockUse = jest.fn();
const mockOn = jest.fn();
const mockRedisAdapter = jest.fn(() => "redis-adapter");
const mockServer = jest.fn().mockImplementation(() => ({
  adapter: mockAdapter,
  use: mockUse,
  on: mockOn
}));

jest.mock("socket.io", () => ({
  Server: mockServer
}));

jest.mock("socket.io-redis", () => mockRedisAdapter);

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

import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import User from "../../../models/User";
import { initIO } from "../../../libs/socket";

type SocketMiddleware = (
  socket: any,
  next: (error?: Error) => void
) => Promise<void>;

const getAuthMiddleware = (): SocketMiddleware => {
  initIO({} as any);
  expect(mockUse).toHaveBeenCalledTimes(1);
  return mockUse.mock.calls[0][0] as SocketMiddleware;
};

describe("socket initIO authentication middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows a valid token without also returning an authentication error", async () => {
    const user = {
      id: 7,
      tenantId: 42,
      name: "Atendente",
      email: "agent@example.com",
      profile: "admin"
    };
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 7,
        tenantId: 42,
        profile: "admin"
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    const socket = {
      id: "socket-1",
      handshake: {
        auth: {
          token: "valid-token",
          client: "web"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    const middleware = getAuthMiddleware();
    await middleware(socket, next);

    expect(decodeTokenSocket).toHaveBeenCalledWith("valid-token");
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
      client: "web",
      id: "7",
      tenantId: "42",
      profile: "admin",
      user
    });
    expect(next.mock.calls).toEqual([[]]);
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it("rejects an invalid token with a single authentication error", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        tenantId: 0,
        profile: ""
      }
    });

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

    const middleware = getAuthMiddleware();
    await middleware(socket, next);

    expect(User.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
    expect(socket.emit).not.toHaveBeenCalled();
  });
});
