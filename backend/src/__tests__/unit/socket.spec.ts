const mockSocketServerInstance = {
  adapter: jest.fn(),
  use: jest.fn(),
  on: jest.fn()
};

jest.mock("socket.io", () => ({
  Server: jest.fn(() => mockSocketServerInstance)
}));

jest.mock("socket.io-redis", () => jest.fn(() => "redis-adapter"));

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

import { initIO } from "../../libs/socket";
import decodeTokenSocket from "../../libs/decodeTokenSocket";
import User from "../../models/User";

describe("socket initIO auth middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls next once without an auth error when the token is valid", async () => {
    const decodedToken = {
      isValid: true,
      data: {
        id: 42,
        profile: "admin",
        tenantId: 7
      }
    };
    const user = { id: 42, name: "Admin", tenantId: 7 };
    (decodeTokenSocket as jest.Mock).mockReturnValue(decodedToken);
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    initIO({} as any);
    const middleware = mockSocketServerInstance.use.mock.calls[0][0];
    const socket = {
      id: "socket-1",
      handshake: {
        auth: {
          token: "valid-token",
          preserved: true
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(socket.handshake.auth).toMatchObject({
      token: "valid-token",
      preserved: true,
      id: "42",
      profile: "admin",
      tenantId: "7",
      user
    });
  });

  it("rejects invalid tokens once with an authentication error", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    initIO({} as any);
    const middleware = mockSocketServerInstance.use.mock.calls[0][0];
    const next = jest.fn();

    await middleware(
      {
        id: "socket-2",
        handshake: {
          auth: {
            token: "invalid-token"
          }
        },
        emit: jest.fn()
      },
      next
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
    expect(User.findByPk).not.toHaveBeenCalled();
  });
});
