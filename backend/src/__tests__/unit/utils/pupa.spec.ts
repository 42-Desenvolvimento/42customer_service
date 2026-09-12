jest.mock("date-fns", () => ({
  getHours: jest.fn()
}));

import { getHours } from "date-fns";
import { MissingValueError, pupa } from "../../../utils/pupa";

describe("pupa", () => {
  it.each([
    [5, "Olá!"],
    [6, "Bom dia!"],
    [11, "Bom dia!"],
    [12, "Boa Tarde!"],
    [17, "Boa Tarde!"],
    [18, "Boa Noite!"],
    [23, "Boa Noite!"]
  ])("resolves the dynamic greeting for hour %s", (hour, greeting) => {
    (getHours as jest.Mock).mockReturnValue(hour);

    expect(pupa("{greeting}", {})).toBe(greeting);
  });

  it("calculates the greeting on each interpolation instead of reusing a stale value", () => {
    (getHours as jest.Mock)
      .mockReturnValueOnce(9)
      .mockReturnValueOnce(19);

    expect(pupa("{greeting}", {})).toBe("Bom dia!");
    expect(pupa("{greeting}", {})).toBe("Boa Noite!");
  });

  it("preserves existing missing-placeholder behavior when strict interpolation is requested", () => {
    (getHours as jest.Mock).mockReturnValue(9);

    expect(() => pupa("{customer.name}", {}, { ignoreMissing: false })).toThrow(
      MissingValueError
    );
  });
});
