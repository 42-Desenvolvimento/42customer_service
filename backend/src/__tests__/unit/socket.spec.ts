jest.mock("socket.io", () => ({
  Server: jest.fn()
}));

jest.mock("socket.io-redis", () => jest.fn(() => "redis-adapter"));

jest.mock("../../libs/decodeTokenSocket", () => jest.fn());

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
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

import { Server as SocketServer } from "socket.io";
import decodeTokenSocket from "../../libs/decodeTokenSocket";
import User from "../../models/User";
import { initIO } from "../../libs/socket";

const createIoMock = () => ({
  adapter: jest.fn(),
  on: jest.fn(),
  use: jest.fn()
});

describe("socket initIO authentication middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows a valid token once and enriches socket auth with user data", async () => {
    const ioMock = createIoMock();
    const user = { id: 7, name: "Agent", tenantId: 3 };
    (SocketServer as unknown as jest.Mock).mockImplementation(() => ioMock);
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 7,
        profile: "admin",
        tenantId: 3
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    initIO({} as any);

    const middleware = ioMock.use.mock.calls[0][0];
    const socket = {
      handshake: {
        auth: {
          token: "valid-token"
        }
      },
      id: "socket-1",
      emit: jest.fn()
    };
    const next = jest.fn();

    await middleware(socket, next);

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
      id: "7",
      profile: "admin",
      tenantId: "3",
      token: "valid-token",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]).toEqual([]);
  });

  it("rejects an invalid token without loading a user", async () => {
    const ioMock = createIoMock();
    (SocketServer as unknown as jest.Mock).mockImplementation(() => ioMock);
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    initIO({} as any);

    const middleware = ioMock.use.mock.calls[0][0];
    const next = jest.fn();

    await middleware(
      {
        handshake: {
          auth: {
            token: "invalid-token"
          }
        },
        id: "socket-2",
        emit: jest.fn()
      },
      next
    );

    expect(User.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });
});
