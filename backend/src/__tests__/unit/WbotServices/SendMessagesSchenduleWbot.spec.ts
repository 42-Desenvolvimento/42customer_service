jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: {
    findAll: jest.fn()
  }
}));

jest.mock("../../../models/Ticket", () => ({
  __esModule: true,
  default: {}
}));

jest.mock("../../../models/Contact", () => ({
  __esModule: true,
  default: {}
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock("../../../services/WbotServices/SendMessage", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../helpers/SendMessageSystemProxy", () => ({
  __esModule: true,
  default: jest.fn()
}));

import { Op } from "sequelize";
import Contact from "../../../models/Contact";
import Message from "../../../models/Message";
import Ticket from "../../../models/Ticket";
import SendMessageSystemProxy from "../../../helpers/SendMessageSystemProxy";
import SendMessage from "../../../services/WbotServices/SendMessage";
import SendMessagesSchenduleWbot from "../../../services/WbotServices/SendMessagesSchenduleWbot";

const messageMock = Message as unknown as { findAll: jest.Mock };
const sendMessageSystemProxyMock = SendMessageSystemProxy as jest.Mock;
const sendMessageMock = SendMessage as jest.Mock;

describe("SendMessagesSchenduleWbot", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TIMEZONE = "UTC";
    jest.useFakeTimers("modern");
    jest.setSystemTime(new Date("2026-08-21T15:30:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
    delete process.env.TIMEZONE;
  });

  it("queries only pending outbound scheduled messages from the last 24 hours", async () => {
    messageMock.findAll.mockResolvedValue([]);

    await SendMessagesSchenduleWbot();

    expect(messageMock.findAll).toHaveBeenCalledTimes(1);
    const query = messageMock.findAll.mock.calls[0][0];

    expect(query.where).toMatchObject({
      fromMe: true,
      status: "pending"
    });
    expect(query.where.messageId).toEqual({ [Op.is]: null });
    expect(query.where.scheduleDate[Op.lte]).toEqual(
      new Date("2026-08-21T15:30:00.000Z")
    );
    expect(
      query.where.scheduleDate[Op.lte].getTime() -
        query.where.scheduleDate[Op.gte].getTime()
    ).toBe(24 * 60 * 60 * 1000);
    expect(query.include).toEqual([
      {
        model: Contact,
        as: "contact"
      },
      {
        model: Ticket,
        as: "ticket",
        where: {
          status: ["open", "pending"]
        },
        include: ["contact"]
      },
      {
        model: Message,
        as: "quotedMsg",
        include: ["contact"]
      }
    ]);
    expect(query.order).toEqual([["createdAt", "ASC"]]);
  });

  it("routes non-whatsapp messages through the system proxy and whatsapp messages through SendMessage", async () => {
    const nonWhatsappMessage = {
      id: 10,
      tenantId: 1,
      userId: 8,
      ticket: {
        id: 20,
        channel: "telegram"
      },
      toJSON: jest.fn().mockReturnValue({ body: "scheduled proxy message" }),
      update: jest.fn()
    };
    const whatsappMessage = {
      id: 11,
      tenantId: 1,
      userId: 9,
      ticket: {
        id: 21,
        channel: "whatsapp"
      },
      toJSON: jest.fn(),
      update: jest.fn()
    };

    messageMock.findAll.mockResolvedValue([nonWhatsappMessage, whatsappMessage]);
    sendMessageSystemProxyMock.mockResolvedValue({
      id: { id: "proxy-message-id" }
    });
    sendMessageMock.mockResolvedValue(undefined);

    await SendMessagesSchenduleWbot();

    expect(sendMessageSystemProxyMock).toHaveBeenCalledWith({
      ticket: nonWhatsappMessage.ticket,
      messageData: { body: "scheduled proxy message" },
      media: null,
      userId: 8
    });
    expect(nonWhatsappMessage.update).toHaveBeenCalledWith({
      messageId: "proxy-message-id",
      status: "sended",
      ack: 2,
      userId: 8
    });
    expect(sendMessageMock).toHaveBeenCalledWith(whatsappMessage);
    expect(whatsappMessage.update).not.toHaveBeenCalled();
  });
});
