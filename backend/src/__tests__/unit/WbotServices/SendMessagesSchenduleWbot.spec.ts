const mockMessageFindAll = jest.fn();
const mockSendMessage = jest.fn();
const mockSendMessageSystemProxy = jest.fn();
const mockLoggerInfo = jest.fn();
const mockLoggerError = jest.fn();
const mockContactModel = { modelName: "Contact" };
const mockTicketModel = { modelName: "Ticket" };

jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: {
    findAll: mockMessageFindAll
  }
}));

jest.mock("../../../models/Contact", () => ({
  __esModule: true,
  default: mockContactModel
}));

jest.mock("../../../models/Ticket", () => ({
  __esModule: true,
  default: mockTicketModel
}));

jest.mock("../../../services/WbotServices/SendMessage", () => ({
  __esModule: true,
  default: mockSendMessage
}));

jest.mock("../../../helpers/SendMessageSystemProxy", () => ({
  __esModule: true,
  default: mockSendMessageSystemProxy
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    info: mockLoggerInfo,
    error: mockLoggerError
  }
}));

import { Op } from "sequelize";
import SendMessagesSchenduleWbot from "../../../services/WbotServices/SendMessagesSchenduleWbot";

describe("SendMessagesSchenduleWbot", () => {
  const originalEnv = process.env;
  const fixedNow = new Date("2026-07-07T15:30:00.000Z");

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers("modern");
    jest.setSystemTime(fixedNow);
    process.env = {
      ...originalEnv,
      TIMEZONE: "UTC"
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("busca somente mensagens pendentes dentro da janela das ultimas 24 horas", async () => {
    mockMessageFindAll.mockResolvedValue([]);

    await SendMessagesSchenduleWbot();

    expect(mockMessageFindAll).toHaveBeenCalledTimes(1);
    const query = mockMessageFindAll.mock.calls[0][0];
    expect(query.where.fromMe).toBe(true);
    expect(query.where.status).toBe("pending");
    expect(query.where.messageId[Op.is]).toBeNull();
    expect(query.where.scheduleDate[Op.lte]).toBeInstanceOf(Date);
    expect(query.where.scheduleDate[Op.gte]).toBeInstanceOf(Date);
    expect(
      query.where.scheduleDate[Op.lte].getTime() -
        query.where.scheduleDate[Op.gte].getTime()
    ).toBe(24 * 60 * 60 * 1000);
    expect(query.include).toEqual([
      {
        model: mockContactModel,
        as: "contact"
      },
      {
        model: mockTicketModel,
        as: "ticket",
        where: {
          status: ["open", "pending"]
        },
        include: ["contact"]
      },
      {
        model: {
          findAll: mockMessageFindAll
        },
        as: "quotedMsg",
        include: ["contact"]
      }
    ]);
    expect(query.order).toEqual([["createdAt", "ASC"]]);
  });

  it("envia mensagens de canais nao WhatsApp pelo proxy e atualiza o identificador retornado", async () => {
    const messageUpdate = jest.fn();
    const messageData = { id: "message-1", body: "ola" };
    const message = {
      id: "message-1",
      tenantId: 4,
      userId: 55,
      ticket: {
        id: 10,
        channel: "telegram"
      },
      toJSON: jest.fn(() => messageData),
      update: messageUpdate
    };
    mockMessageFindAll.mockResolvedValue([message]);
    mockSendMessageSystemProxy.mockResolvedValue({
      id: { id: "provider-message-id" },
      messageId: "fallback-message-id"
    });

    await SendMessagesSchenduleWbot();

    expect(mockSendMessageSystemProxy).toHaveBeenCalledWith({
      ticket: message.ticket,
      messageData,
      media: null,
      userId: 55
    });
    expect(messageUpdate).toHaveBeenCalledWith({
      messageId: "provider-message-id",
      status: "sended",
      ack: 2,
      userId: 55
    });
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("envia mensagens WhatsApp pelo servico dedicado e registra falhas sem interromper o job", async () => {
    const error = new Error("wbot disconnected");
    const whatsappMessage = {
      id: "message-2",
      tenantId: 4,
      ticket: {
        channel: "whatsapp"
      }
    };
    mockMessageFindAll.mockResolvedValue([whatsappMessage]);
    mockSendMessage.mockRejectedValue(error);

    await expect(SendMessagesSchenduleWbot()).resolves.toBeUndefined();

    expect(mockSendMessage).toHaveBeenCalledWith(whatsappMessage);
    expect(mockSendMessageSystemProxy).not.toHaveBeenCalled();
    expect(mockLoggerError).toHaveBeenCalledWith(
      "SendMessagesSchenduleWbot > SendMessage",
      error
    );
  });
});
