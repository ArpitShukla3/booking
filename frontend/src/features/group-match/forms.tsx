import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Moon, Search, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, Form } from "@/components/ui/form";
import { ApiError } from "@/lib/api";
import type { Destination } from "@/types/group";
import type { DepartureCity } from "@/types/search";
import type { Interest } from "@/types/traveller";
import { liveSearchSchema, nights, WINDOW_END, WINDOW_START } from "./searchSchema";
import type { LiveSearchForm } from "./searchSchema";

export interface SearchCatalogs {
  destinations: Destination[];
  interests: Interest[];
  departureCities: DepartureCity[];
}

const FIELDS: (keyof LiveSearchForm)[] = ["home_city", "city", "check_in", "check_out", "budget_inr", "interests", "gender_preference"];

/** Seeker search (M3). Every option comes from the backend; gender comes from the profile. */
export function GroupSearchForm({
  initial,
  catalogs,
  gender,
  onSearch,
}: {
  initial: LiveSearchForm;
  catalogs: SearchCatalogs;
  gender: "FEMALE" | "MALE";
  onSearch: (input: LiveSearchForm) => Promise<void>;
}) {
  const [formError, setFormError] = useState("");
  const form = useForm<LiveSearchForm>({
    resolver: zodResolver(liveSearchSchema),
    defaultValues: initial,
    mode: "onTouched",
  });
  const { register, control, reset, setError, setFocus, formState: { errors, isSubmitting } } = form;
  const initialKey = JSON.stringify(initial);
  useEffect(() => { reset(JSON.parse(initialKey)); }, [initialKey, reset]);
  const checkIn = useWatch({ control, name: "check_in" });
  const checkOut = useWatch({ control, name: "check_out" });
  const nightCount = nights(checkIn, checkOut);
  const a11y = (name: keyof LiveSearchForm) => ({
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });

  const submit = form.handleSubmit(async (values) => {
    setFormError("");
    try {
      await onSearch(values);
    } catch (error) {
      if (error instanceof ApiError) {
        const known = Object.entries(error.fields).filter(([f]) => FIELDS.includes(f as keyof LiveSearchForm));
        for (const [field, message] of known) setError(field as keyof LiveSearchForm, { type: "server", message });
        if (known.length) { setFocus(known[0][0] as keyof LiveSearchForm); return; }
      }
      setFormError(error instanceof Error ? error.message : "Search failed. Please try again.");
    }
  });

  return (
    <Form {...form}>
      <form className="discovery-search" onSubmit={submit} noValidate aria-label="Group travel requirements">
        <div className="search-form-heading">
          <Search size={20} aria-hidden="true" />
          <h2>Find your group</h2>
        </div>
        <Field id="city" label="Destination" error={errors.city?.message}>
          <Select id="city" {...register("city")} {...a11y("city")}>
            <option value="">Where are you going?</option>
            {catalogs.destinations.map((d) => (
              <option key={d.city} value={d.city}>{d.city}, {d.country_name}</option>
            ))}
          </Select>
        </Field>
        <div className="date-fields">
          <Field id="check_in" label="Check-in" error={errors.check_in?.message}>
            <Input id="check_in" type="date" min={WINDOW_START} max="2027-04-19" {...register("check_in")} {...a11y("check_in")} />
          </Field>
          <Field id="check_out" label="Check-out" error={errors.check_out?.message}>
            <Input id="check_out" type="date" min={checkIn || "2027-04-02"} max={WINDOW_END} {...register("check_out")} {...a11y("check_out")} />
          </Field>
        </div>
        <p className="field-hint">
          Travel window: 1–20 April 2027
          {nightCount > 0 ? (
            <span className="gm-nights" key={nightCount}><Moon size={12} aria-hidden="true" />{nightCount} night{nightCount === 1 ? "" : "s"}</span>
          ) : null}
        </p>
        <Field id="home_city" label="Home city" error={errors.home_city?.message}>
          <Select id="home_city" {...register("home_city")} {...a11y("home_city")}>
            <option value="">Where do you start from?</option>
            {catalogs.departureCities.map((c) => (
              <option key={c.airport} value={c.city}>{c.city} ({c.airport})</option>
            ))}
          </Select>
        </Field>
        <Field id="budget_inr" label="Budget per person (INR)" error={errors.budget_inr?.message}>
          <Input id="budget_inr" type="number" min="1" step="1000" inputMode="numeric" placeholder="60000"
            {...register("budget_inr", { valueAsNumber: true })} {...a11y("budget_inr")} />
        </Field>
        <Controller
          name="interests"
          control={control}
          render={({ field }) => (
            <fieldset className="interest-picker">
              <legend>Interests</legend>
              <p className="field-hint">Choose at least two. {field.value.length ? `${field.value.length} selected` : ""}</p>
              <div className="interest-options">
                {catalogs.interests.map((interest, index) => (
                  <label key={interest.interest} htmlFor={`interest-${interest.interest}`}
                    className={field.value.includes(interest.interest) ? "interest-option checked" : "interest-option"}>
                    <Checkbox
                      ref={index === 0 ? field.ref : undefined}
                      id={`interest-${interest.interest}`}
                      checked={field.value.includes(interest.interest)}
                      onCheckedChange={(checked) =>
                        field.onChange(checked ? [...field.value, interest.interest] : field.value.filter((i) => i !== interest.interest))
                      }
                      aria-invalid={!!errors.interests}
                      aria-describedby={errors.interests ? "interests-error" : undefined}
                    />
                    {interest.label}
                  </label>
                ))}
              </div>
              {errors.interests ? <p id="interests-error" className="field-error" role="alert">{errors.interests.message}</p> : null}
            </fieldset>
          )}
        />
        <Field id="gender_preference" label="Gender preference" error={errors.gender_preference?.message}>
          <Select id="gender_preference" {...register("gender_preference")} {...a11y("gender_preference")}>
            <option value="ANY">Any gender</option>
            <option value="SAME_GENDER">Same gender as me</option>
          </Select>
        </Field>
        <p className="gm-gender-note">
          <UserRound size={14} aria-hidden="true" />
          Matching as <strong>{gender === "FEMALE" ? "female" : "male"}</strong> (from your profile)
        </p>
        {formError ? <p className="field-error" role="alert">{formError}</p> : null}
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          <Search size={17} aria-hidden="true" />
          {isSubmitting ? "Searching…" : "Search Groups"}
        </Button>
      </form>
    </Form>
  );
}
