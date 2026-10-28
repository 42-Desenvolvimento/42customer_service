import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { initIO } from "../../../libs/socket";
import Chat from "../../../libs/socketChat/Chat";
import User from "../../../models/User";

jest.mock("socket.io", () => ({
  Server: jest.fn().mockImplementation(() => ({
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  }))
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

const getAuthMiddleware = () => {
  initIO({} as any);

  const { Server } = jest.requireMock("socket.io") as {
    Server: jest.Mock;
  };
  const socketServer = Server.mock.results[0].value;

  return socketServer.use.mock.calls[0][0] as (
    socket: any,
    next: jest.Mock
  ) => Promise<void>;
};

describe("socket initIO authentication", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("accepts a valid token once and enriches the socket auth data", async () => {
    const user = { id: 12, name: "Agent" };
    const socket = {
      handshake: {
        auth: {
          token: "valid-token",
          clientVersion: "web"
        }
      }
    };
    const next = jest.fn();

    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 12,
        tenantId: 34,
        profile: "admin"
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    await getAuthMiddleware()(socket, next);

    expect(User.findByPk).toHaveBeenCalledWith(12, {
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
      clientVersion: "web",
      id: "12",
      tenantId: "34",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects invalid tokens with an authentication error", async () => {
    const socket = {
      handshake: {
        auth: {
          token: "invalid-token"
        }
      }
    };
    const next = jest.fn();

    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        tenantId: 0,
        profile: ""
      }
    });

    await getAuthMiddleware()(socket, next);

    expect(User.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toMatchObject({
      message: "authentication error"
    });
  });

  it("registers tenant rooms only when the socket has tenant auth data", () => {
    initIO({} as any);

    const { Server } = jest.requireMock("socket.io") as {
      Server: jest.Mock;
    };
    const socketServer = Server.mock.results[0].value;
    const onConnection = socketServer.on.mock.calls[0][1];
    const join = jest.fn();
    const on = jest.fn();

    onConnection({
      handshake: {
        auth: {
          tenantId: "34"
        }
      },
      join,
      on
    });

    expect(join).toHaveBeenCalledWith("34");
    expect(on).toHaveBeenCalledWith("34:joinChatBox", expect.any(Function));
    expect(on).toHaveBeenCalledWith("34:joinNotification", expect.any(Function));
    expect(on).toHaveBeenCalledWith("34:joinTickets", expect.any(Function));
    expect(Chat.register).toHaveBeenCalled();
  });
});
