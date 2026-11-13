import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, Form } from "@/components/ui/form";
import { cities, searchSchema } from "@/lib/schemas";
import interests from "@/data/interests.json";
import type { GroupSearch } from "@/types/groupMatch";

export function GroupSearchForm({
  input,
  onSearch,
  loading,
}: {
  input: GroupSearch;
  onSearch: (input: GroupSearch) => void;
  loading: boolean;
}) {
  const form = useForm<z.infer<typeof searchSchema>>({
    resolver: zodResolver(searchSchema),
    defaultValues: input as z.infer<typeof searchSchema>,
  });
  const {
    register,
    control,
    reset,
    formState: { errors },
  } = form;
  const inputKey = JSON.stringify(input);
  useEffect(() => {
    reset(JSON.parse(inputKey));
  }, [inputKey, reset]);
  const fieldA11y = (name: keyof GroupSearch) => ({
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });
  return (
    <Form {...form}>
      <form
        className="discovery-search"
        onSubmit={form.handleSubmit(onSearch)}
        noValidate
        aria-label="Group travel requirements"
      >
        <div className="search-form-heading">
          <Search size={20} aria-hidden="true" />
          <h2>Find your group</h2>
        </div>
        <Field id="city" label="Destination" error={errors.city?.message}>
          <Select id="city" {...register("city")} {...fieldA11y("city")}>
            {cities.map((city) => (
              <option key={city}>{city}</option>
            ))}
          </Select>
        </Field>
        <div className="date-fields">
          <Field
            id="check_in"
            label="Check-in"
            error={errors.check_in?.message}
          >
            <Input
              id="check_in"
              type="date"
              min="2027-04-01"
              max="2027-04-19"
              {...register("check_in")}
              {...fieldA11y("check_in")}
            />
          </Field>
          <Field
            id="check_out"
            label="Check-out"
            error={errors.check_out?.message}
          >
            <Input
              id="check_out"
              type="date"
              min="2027-04-02"
              max="2027-04-20"
              {...register("check_out")}
              {...fieldA11y("check_out")}
            />
          </Field>
        </div>
        <p className="field-hint">Travel window: 1–20 April 2027</p>
        <Field
          id="budget_inr"
          label="Budget per person (INR)"
          error={errors.budget_inr?.message}
        >
          <Input
            id="budget_inr"
            type="number"
            min="1"
            inputMode="numeric"
            {...register("budget_inr", { valueAsNumber: true })}
            {...fieldA11y("budget_inr")}
          />
        </Field>
        <Controller
          name="interests"
          control={control}
          render={({ field }) => (
            <fieldset className="interest-picker">
              <legend>Interests</legend>
              <p className="field-hint">Choose at least two.</p>
              <div className="interest-options">
                {interests.map((interest, index) => (
                  <label
                    key={interest.interest}
                    htmlFor={`interest-${interest.interest}`}
                    className={
                      field.value.includes(interest.interest)
                        ? "interest-option checked"
                        : "interest-option"
                    }
                  >
                    <Checkbox
                      ref={index === 0 ? field.ref : undefined}
                      id={`interest-${interest.interest}`}
                      name={index === 0 ? field.name : undefined}
                      checked={field.value.includes(interest.interest)}
                      onCheckedChange={(checked) =>
                        field.onChange(
                          checked
                            ? [...field.value, interest.interest]
                            : field.value.filter(
                                (i) => i !== interest.interest,
                              ),
                        )
                      }
                      aria-invalid={!!errors.interests}
                      aria-describedby={
                        errors.interests ? "interests-error" : undefined
                      }
                    />
                    {interest.label}
                  </label>
                ))}
              </div>
              {errors.interests ? (
                <p id="interests-error" className="field-error" role="alert">
                  {errors.interests.message}
                </p>
              ) : null}
            </fieldset>
          )}
        />
        <Field
          id="gender_preference"
          label="Gender preference"
          error={errors.gender_preference?.message}
        >
          <Select
            id="gender_preference"
            {...register("gender_preference")}
            {...fieldA11y("gender_preference")}
          >
            <option value="ANY">Any gender</option>
            <option value="SAME_GENDER">Same gender as me</option>
          </Select>
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          <Search size={17} aria-hidden="true" />
          {loading ? "Searching…" : "Search Groups"}
        </Button>
      </form>
    </Form>
  );
}
