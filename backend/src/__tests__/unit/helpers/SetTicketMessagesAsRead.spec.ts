import Message from "../../../models/Message";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";
import socketEmit from "../../../helpers/socketEmit";

jest.mock("../../../models/Message", () => ({
  update: jest.fn()
}));

jest.mock("../../../helpers/GetTicketWbot", () => jest.fn());

jest.mock("../../../helpers/socketEmit", () => jest.fn());

jest.mock("../../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));

jest.mock("../../../services/TicketServices/ShowTicketService", () =>
  jest.fn()
);

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: jest.fn()
  }
}));

const mockMessageUpdate = Message.update as jest.Mock;
const mockGetTicketWbot = GetTicketWbot as jest.MockedFunction<
  typeof GetTicketWbot
>;
const mockShowTicketService = ShowTicketService as jest.MockedFunction<
  typeof ShowTicketService
>;
const mockSocketEmit = socketEmit as jest.MockedFunction<typeof socketEmit>;
const mockStartWhatsAppSessionVerify =
  StartWhatsAppSessionVerify as jest.MockedFunction<
    typeof StartWhatsAppSessionVerify
  >;

describe("SetTicketMessagesAsRead", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("should verify the whatsapp session when sendSeen rejects", async () => {
    const sendSeenError = new Error("session closed");
    const sendSeen = jest.fn().mockRejectedValue(sendSeenError);
    mockGetTicketWbot.mockResolvedValue({ sendSeen } as any);
    mockShowTicketService.mockResolvedValue({ id: 123 } as any);

    const ticket = {
      id: 123,
      tenantId: 5,
      whatsappId: 42,
      channel: "whatsapp",
      isGroup: false,
      contact: {
        number: "5511888888888"
      },
      update: jest.fn()
    } as any;

    await SetTicketMessagesAsRead(ticket);
    await Promise.resolve();

    expect(mockMessageUpdate).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: 123,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(sendSeen).toHaveBeenCalledWith("5511888888888@c.us");
    expect(mockStartWhatsAppSessionVerify).toHaveBeenCalledWith(
      42,
      sendSeenError
    );
    expect(mockShowTicketService).toHaveBeenCalledWith({
      id: 123,
      tenantId: 5
    });
    expect(mockSocketEmit).toHaveBeenCalledWith({
      tenantId: 5,
      type: "ticket:update",
      payload: { id: 123 }
    });
  });
});
