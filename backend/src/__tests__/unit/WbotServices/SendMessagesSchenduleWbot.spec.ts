jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: {
    findAll: jest.fn(),
    update: jest.fn()
  }
}));

jest.mock("../../../models/Contact", () => ({
  __esModule: true,
  default: { modelName: "Contact" }
}));

jest.mock("../../../models/Ticket", () => ({
  __esModule: true,
  default: { modelName: "Ticket" }
}));

jest.mock("../../../services/WbotServices/SendMessage", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../helpers/SendMessageSystemProxy", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn()
  }
}));

import { Op } from "sequelize";
import Message from "../../../models/Message";
import SendMessageSystemProxy from "../../../helpers/SendMessageSystemProxy";
import SendMessage from "../../../services/WbotServices/SendMessage";
import SendMessagesSchenduleWbot from "../../../services/WbotServices/SendMessagesSchenduleWbot";

describe("SendMessagesSchenduleWbot", () => {
  const originalTimezone = process.env.TIMEZONE;

  beforeEach(() => {
    process.env.TIMEZONE = "UTC";
    jest.useFakeTimers("modern" as any);
    jest.setSystemTime(new Date("2024-05-02T15:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env.TIMEZONE = originalTimezone;
  });

  it("queries only pending scheduled messages from the last 24 hours in the configured timezone", async () => {
    (Message.findAll as jest.Mock).mockResolvedValue([]);

    await SendMessagesSchenduleWbot();

    const findOptions = (Message.findAll as jest.Mock).mock.calls[0][0];

    expect(findOptions.where).toMatchObject({
      fromMe: true,
      status: "pending",
      messageId: { [Op.is]: null }
    });
    expect(findOptions.where.scheduleDate[Op.lte].toISOString()).toBe(
      "2024-05-02T15:00:00.000Z"
    );
    expect(findOptions.where.scheduleDate[Op.gte].toISOString()).toBe(
      "2024-05-01T15:00:00.000Z"
    );
    expect(findOptions.order).toEqual([["createdAt", "ASC"]]);
  });

  it("dispatches non-whatsapp messages through the system proxy and records the sent status", async () => {
    const update = jest.fn();
    const message = {
      id: "message-1",
      tenantId: 1,
      userId: 42,
      ticket: {
        channel: "instagram"
      },
      toJSON: jest.fn().mockReturnValue({ body: "scheduled body" }),
      update
    };

    (Message.findAll as jest.Mock).mockResolvedValue([message]);
    (SendMessageSystemProxy as jest.Mock).mockResolvedValue({
      id: { id: "sent-message-id" }
    });

    await SendMessagesSchenduleWbot();

    expect(SendMessageSystemProxy).toHaveBeenCalledWith({
      ticket: message.ticket,
      messageData: { body: "scheduled body" },
      media: null,
      userId: 42
    });
    expect(update).toHaveBeenCalledWith({
      messageId: "sent-message-id",
      status: "sended",
      ack: 2,
      userId: 42
    });
  });

  it("dispatches whatsapp messages through the whatsapp sender", async () => {
    const message = {
      id: "message-2",
      tenantId: 1,
      ticket: {
        channel: "whatsapp"
      }
    };

    (Message.findAll as jest.Mock).mockResolvedValue([message]);
    (SendMessage as jest.Mock).mockResolvedValue(undefined);

    await SendMessagesSchenduleWbot();

    expect(SendMessage).toHaveBeenCalledWith(message);
    expect(SendMessageSystemProxy).not.toHaveBeenCalled();
  });
});
