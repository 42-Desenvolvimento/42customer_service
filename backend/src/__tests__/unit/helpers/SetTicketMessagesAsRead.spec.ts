/* eslint-disable import/first, @typescript-eslint/no-explicit-any */

jest.mock("../../../models/Message", () => ({
  update: jest.fn()
}));

jest.mock("../../../helpers/GetTicketWbot", () => jest.fn());

jest.mock("../../../services/TicketServices/ShowTicketService", () =>
  jest.fn()
);

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

jest.mock("../../../helpers/socketEmit", () => jest.fn());

jest.mock("../../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: jest.fn()
  }
}));

import Message from "../../../models/Message";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";
import socketEmit from "../../../helpers/socketEmit";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

const mockedMessage = Message as jest.Mocked<typeof Message>;
const mockedGetTicketWbot = GetTicketWbot as jest.Mock;
const mockedShowTicketService = ShowTicketService as jest.Mock;
const mockedSocketEmit = socketEmit as jest.Mock;
const mockedStartWhatsAppSessionVerify =
  StartWhatsAppSessionVerify as jest.Mock;

describe("SetTicketMessagesAsRead", () => {
  const buildTicket = (overrides = {}) =>
    ({
      id: 123,
      tenantId: 5,
      whatsappId: 9,
      channel: "whatsapp",
      isGroup: false,
      contact: {
        number: "5511999999999",
        messengerId: "messenger-contact-id"
      },
      update: jest.fn().mockResolvedValue(undefined),
      ...overrides
    } as any);

  beforeEach(() => {
    mockedMessage.update.mockResolvedValue([1] as any);
    mockedShowTicketService.mockResolvedValue({ id: 123, unreadMessages: 0 });
  });

  it("marks local messages as read and emits the reloaded ticket", async () => {
    const sendSeen = jest.fn().mockResolvedValue(undefined);
    const ticket = buildTicket();
    mockedGetTicketWbot.mockResolvedValue({ sendSeen });

    await SetTicketMessagesAsRead(ticket);

    expect(mockedMessage.update).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: ticket.id,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(sendSeen).toHaveBeenCalledWith("5511999999999@c.us");
    expect(mockedShowTicketService).toHaveBeenCalledWith({
      id: ticket.id,
      tenantId: ticket.tenantId
    });
    expect(mockedSocketEmit).toHaveBeenCalledWith({
      tenantId: ticket.tenantId,
      type: "ticket:update",
      payload: { id: 123, unreadMessages: 0 }
    });
  });

  it("verifies the WhatsApp session when sendSeen rejects asynchronously", async () => {
    const readReceiptError = new Error("Session closed");
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const ticket = buildTicket();
    mockedGetTicketWbot.mockResolvedValue({
      sendSeen: jest.fn().mockRejectedValue(readReceiptError)
    });

    await SetTicketMessagesAsRead(ticket);
    await Promise.resolve();

    expect(mockedStartWhatsAppSessionVerify).toHaveBeenCalledWith(
      ticket.whatsappId,
      readReceiptError
    );
    expect(mockedSocketEmit).toHaveBeenCalledWith({
      tenantId: ticket.tenantId,
      type: "ticket:update",
      payload: { id: 123, unreadMessages: 0 }
    });
    expect(consoleError).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      readReceiptError
    );

    consoleError.mockRestore();
  });
});
