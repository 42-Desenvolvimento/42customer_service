jest.mock("socket.io", () => {
  const mockAdapter = jest.fn();
  const mockUse = jest.fn();
  const mockOn = jest.fn();

  return {
    Server: jest.fn(() => ({
      adapter: mockAdapter,
      use: mockUse,
      on: mockOn
    })),
    __mockAdapter: mockAdapter,
    __mockUse: mockUse,
    __mockOn: mockOn
  };
});

jest.mock("socket.io-redis", () => ({
  __esModule: true,
  default: jest.fn(() => "redis-adapter")
}));

jest.mock("../../../libs/decodeTokenSocket", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../models/User", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn()
  }
}));

jest.mock("../../../libs/socketChat/Chat", () => ({
  __esModule: true,
  default: {
    register: jest.fn()
  }
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import User from "../../../models/User";
import { initIO } from "../../../libs/socket";

const socketIoMock = jest.requireMock("socket.io") as {
  __mockUse: jest.Mock;
};

describe("libs/socket", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const buildSocket = (token: string) =>
    ({
      id: "socket-1",
      handshake: {
        auth: {
          token,
          keep: "existing-auth-data"
        }
      },
      emit: jest.fn(),
      join: jest.fn(),
      on: jest.fn()
    } as any);

  const getAuthMiddleware = () => {
    initIO({} as any);
    return socketIoMock.__mockUse.mock.calls[0][0];
  };

  it("authenticates a valid token without also emitting an authentication error", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 123,
        profile: "admin",
        tenantId: 456
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue({
      id: 123,
      tenantId: 456,
      name: "Admin"
    });
    const socket = buildSocket("valid-token");
    const next = jest.fn();

    await getAuthMiddleware()(socket, next);

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
      keep: "existing-auth-data",
      id: "123",
      tenantId: "456",
      user: {
        id: 123,
        tenantId: 456,
        name: "Admin"
      }
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects an invalid token before loading a user", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });
    const socket = buildSocket("invalid-token");
    const next = jest.fn();

    await getAuthMiddleware()(socket, next);

    expect(User.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });
});
