let mockMiddleware: ((socket: any, next: any) => Promise<void>) | undefined;
let mockConnectionHandler: ((socket: any) => void) | undefined;

const mockAdapter = jest.fn();
const mockUse = jest.fn((handler: (socket: any, next: any) => Promise<void>) => {
  mockMiddleware = handler;
});
const mockOn = jest.fn((event: string, handler: (socket: any) => void) => {
  if (event === "connection") {
    mockConnectionHandler = handler;
  }
});
const mockRedisAdapter = jest.fn(config => ({ config }));

jest.mock("socket.io", () => ({
  Server: jest.fn().mockImplementation(() => ({
    adapter: mockAdapter,
    use: mockUse,
    on: mockOn
  }))
}));

jest.mock("socket.io-redis", () => mockRedisAdapter);

jest.mock("../../libs/decodeTokenSocket", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../models/User", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn()
  }
}));

jest.mock("../../libs/socketChat/Chat", () => ({
  __esModule: true,
  default: {
    register: jest.fn()
  }
}));

jest.mock("../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn()
  }
}));

import decodeTokenSocket from "../../libs/decodeTokenSocket";
import User from "../../models/User";
import Chat from "../../libs/socketChat/Chat";
import { initIO } from "../../libs/socket";

describe("socket", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMiddleware = undefined;
    mockConnectionHandler = undefined;
  });

  it("authenticates a valid token once without passing an error to next", async () => {
    const user = {
      id: 123,
      tenantId: 456,
      name: "Agent"
    };
    const socket = {
      id: "socket-id",
      handshake: {
        auth: {
          token: "valid-token",
          keep: "value"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 123,
        profile: "admin",
        tenantId: 456
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    initIO({} as any);
    await mockMiddleware!(socket, next);

    expect(User.findByPk).toHaveBeenCalledWith(123, {
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
      id: "123",
      tenantId: "456",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]).toEqual([]);
  });

  it("rejects invalid tokens without loading a user", async () => {
    const socket = {
      id: "socket-id",
      handshake: {
        auth: {
          token: "invalid-token"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    initIO({} as any);
    await mockMiddleware!(socket, next);

    expect(User.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });

  it("registers chat handlers only when the socket has a tenant", () => {
    const socket = {
      handshake: {
        auth: {
          tenantId: "456"
        }
      },
      join: jest.fn(),
      on: jest.fn()
    };

    initIO({} as any);
    mockConnectionHandler!(socket);

    expect(socket.join).toHaveBeenCalledWith("456");
    expect(socket.on).toHaveBeenCalledWith(
      "456:joinNotification",
      expect.any(Function)
    );
    expect(Chat.register).toHaveBeenCalledWith(socket);
  });
});

export {};
