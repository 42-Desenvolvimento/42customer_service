jest.mock("socket.io", () => {
  const mockServerInstance = {
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  };

  return {
    Server: jest.fn(() => mockServerInstance),
    __mockServerInstance: mockServerInstance
  };
});

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

const mockedDecodeTokenSocket = decodeTokenSocket as jest.Mock;
const mockedFindByPk = User.findByPk as jest.Mock;

describe("socket", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("authenticates a valid token and calls next only once without an error", async () => {
    const socketIoMock = jest.requireMock("socket.io");
    const serverInstance = socketIoMock.__mockServerInstance;
    const user = { id: 15, tenantId: 4, name: "Agent" };

    mockedDecodeTokenSocket.mockReturnValue({
      isValid: true,
      data: {
        id: 15,
        profile: "admin",
        tenantId: 4
      }
    });
    mockedFindByPk.mockResolvedValue(user);

    initIO({} as any);

    const middleware = serverInstance.use.mock.calls[0][0];
    const next = jest.fn();
    const socket = {
      handshake: {
        auth: {
          token: "valid-token",
          existing: "keep-me"
        }
      },
      emit: jest.fn()
    };

    await middleware(socket, next);

    expect(mockedDecodeTokenSocket).toHaveBeenCalledWith("valid-token");
    expect(mockedFindByPk).toHaveBeenCalledWith(15, {
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
      existing: "keep-me",
      id: "15",
      profile: "admin",
      tenantId: "4",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects invalid tokens with an authentication error", async () => {
    const socketIoMock = jest.requireMock("socket.io");
    const serverInstance = socketIoMock.__mockServerInstance;

    mockedDecodeTokenSocket.mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    initIO({} as any);

    const middleware = serverInstance.use.mock.calls[0][0];
    const next = jest.fn();
    const socket = {
      handshake: {
        auth: {
          token: "invalid-token"
        }
      },
      emit: jest.fn()
    };

    await middleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toMatchObject({
      message: "authentication error"
    });
  });
});
