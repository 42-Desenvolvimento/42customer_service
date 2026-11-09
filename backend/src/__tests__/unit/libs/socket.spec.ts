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
    warn: jest.fn()
  }
}));

import { Server as SocketIOServer } from "socket.io";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { initIO } from "../../../libs/socket";
import User from "../../../models/User";
import Chat from "../../../libs/socketChat/Chat";
import { logger } from "../../../utils/logger";

const mockedSocketIOServer = SocketIOServer as unknown as jest.Mock;
const mockedDecodeTokenSocket = decodeTokenSocket as unknown as jest.Mock;
const mockedUser = User as unknown as { findByPk: jest.Mock };
const mockedChat = Chat as unknown as { register: jest.Mock };
const mockedLogger = logger as unknown as {
  info: jest.Mock;
  warn: jest.Mock;
};

const getCreatedIO = () =>
  mockedSocketIOServer.mock.results[
    mockedSocketIOServer.mock.results.length - 1
  ].value as {
    adapter: jest.Mock;
    use: jest.Mock;
    on: jest.Mock;
  };

describe("socket initIO", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("autentica token valido, carrega o usuario e chama next uma unica vez", async () => {
    mockedDecodeTokenSocket.mockReturnValue({
      isValid: true,
      data: {
        id: 12,
        profile: "admin",
        tenantId: 4
      }
    });
    mockedUser.findByPk.mockResolvedValue({
      id: 12,
      name: "User Test"
    });

    initIO({} as any);
    const io = getCreatedIO();
    const middleware = io.use.mock.calls[0][0];
    const socket = {
      id: "socket-1",
      emit: jest.fn(),
      handshake: {
        auth: {
          token: "valid-token",
          untouched: "value"
        }
      }
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(mockedDecodeTokenSocket).toHaveBeenCalledWith("valid-token");
    expect(mockedUser.findByPk).toHaveBeenCalledWith(12, {
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
      untouched: "value",
      id: "12",
      tenantId: "4",
      profile: "admin",
      user: {
        id: 12,
        name: "User Test"
      }
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]).toHaveLength(0);
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it("recusa token invalido sem consultar usuario", async () => {
    mockedDecodeTokenSocket.mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    initIO({} as any);
    const io = getCreatedIO();
    const middleware = io.use.mock.calls[0][0];
    const next = jest.fn();

    await middleware(
      {
        id: "socket-2",
        emit: jest.fn(),
        handshake: {
          auth: {
            token: "invalid-token"
          }
        }
      },
      next
    );

    expect(mockedUser.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toMatchObject({
      message: "authentication error"
    });
  });

  it("emite tokenInvalid quando a validacao do token lanca erro", async () => {
    mockedDecodeTokenSocket.mockImplementation(() => {
      throw new Error("unexpected jwt failure");
    });

    initIO({} as any);
    const io = getCreatedIO();
    const middleware = io.use.mock.calls[0][0];
    const socket = {
      id: "socket-3",
      emit: jest.fn(),
      handshake: {
        auth: {
          token: "broken-token"
        }
      }
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(mockedLogger.warn).toHaveBeenCalledWith(
      "tokenInvalid: [object Object]"
    );
    expect(socket.emit).toHaveBeenCalledWith("tokenInvalid:socket-3");
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toMatchObject({
      message: "authentication error"
    });
  });

  it("registra conexao em salas do tenant autenticado", () => {
    initIO({} as any);
    const io = getCreatedIO();
    const connectionCall = io.on.mock.calls.find(
      ([eventName]) => eventName === "connection"
    ) as [string, (socket: any) => void];
    const connectionHandler = connectionCall[1];
    const socket = {
      id: "socket-4",
      join: jest.fn(),
      on: jest.fn(),
      handshake: {
        auth: {
          tenantId: "4"
        }
      }
    };

    connectionHandler(socket);

    expect(socket.join).toHaveBeenCalledWith("4");
    expect(socket.on).toHaveBeenCalledWith(
      "4:joinChatBox",
      expect.any(Function)
    );
    expect(socket.on).toHaveBeenCalledWith(
      "4:joinNotification",
      expect.any(Function)
    );
    expect(socket.on).toHaveBeenCalledWith(
      "4:joinTickets",
      expect.any(Function)
    );
    expect(mockedChat.register).toHaveBeenCalledWith(socket);
    expect(mockedLogger.info).toHaveBeenCalledWith({
      message: "Client connected in tenant",
      data: {
        tenantId: "4"
      }
    });
  });
});
