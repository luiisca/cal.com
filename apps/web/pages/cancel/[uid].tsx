import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@radix-ui/react-collapsible";
import { GetServerSidePropsContext } from "next";
import { useRouter } from "next/router";
import { useState } from "react";
import z from "zod";

import dayjs from "@calcom/dayjs";
import CustomBranding from "@calcom/lib/CustomBranding";
import classNames from "@calcom/lib/classNames";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { parseRecurringEvent } from "@calcom/lib/isRecurringEvent";
import { getEveryFreqFor } from "@calcom/lib/recurringStrings";
import { collectPageParameters, telemetryEventTypes, useTelemetry } from "@calcom/lib/telemetry";
import { detectBrowserTimeFormat } from "@calcom/lib/timeFormat";
import { localStorage } from "@calcom/lib/webstorage";
import prisma, { bookingMinimalSelect } from "@calcom/prisma";
import { Icon } from "@calcom/ui/Icon";
import { Button } from "@calcom/ui/components/button";

import { getSession } from "@lib/auth";
import { inferSSRProps } from "@lib/types/inferSSRProps";

import { HeadSeo } from "@components/seo/head-seo";

import { ssrInit } from "@server/lib/ssr";

const querySchema = z.object({
  uid: z.string(),
  allRemainingBookings: z
    .string()
    .optional()
    .transform((val) => (val ? JSON.parse(val) : false)),
});

export default function Type(props: inferSSRProps<typeof getServerSideProps>) {
  const { t } = useLocale();
  // Get router variables
  const router = useRouter();
  const { uid, allRemainingBookings } = querySchema.parse(router.query);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(props.booking ? null : t("booking_already_cancelled"));
  const [cancellationReason, setCancellationReason] = useState<string>("");
  const [moreEventsVisible, setMoreEventsVisible] = useState(false);
  const telemetry = useTelemetry();
  return (
    <div className="h-screen bg-neutral-100 dark:bg-neutral-900">
      <HeadSeo
        title={`${t("cancel")} ${props.booking && props.booking.title} | ${props.profile?.name}`}
        description={`${t("cancel")} ${props.booking && props.booking.title} | ${props.profile?.name}`}
      />
      <CustomBranding lightVal={props.profile?.brandColor} darkVal={props.profile?.darkBrandColor} />
      <main className="h-full sm:flex sm:items-center">
        <div className="mx-auto flex justify-center px-4 pt-4 pb-20 sm:block sm:p-0">
          <div className="inline-block transform overflow-hidden rounded-md border bg-white px-8 pt-5 pb-4 text-left align-bottom transition-all dark:border-neutral-700 dark:bg-gray-800 sm:my-8 sm:w-full sm:max-w-lg sm:py-6 sm:align-middle">
            <div>
              <div>
                {error && (
                  <div>
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                      <Icon.FiX className="h-6 w-6 text-red-600" />
                    </div>
                    <div className="mt-3 text-center sm:mt-5">
                      <h3 className="text-lg font-medium leading-6 text-gray-900" id="modal-title">
                        {error}
                      </h3>
                    </div>
                  </div>
                )}
                {!error && (
                  <>
                    <div>
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                        <Icon.FiX className="h-6 w-6 text-red-600" />
                      </div>
                      <div className="mt-3 text-center sm:mt-5">
                        <h3 className="text-2xl font-semibold leading-6 text-neutral-900 dark:text-white">
                          {props.cancellationAllowed
                            ? t("really_cancel_booking")
                            : t("cannot_cancel_booking")}
                        </h3>
                        <div className="mt-2">
                          <p className="text-sm text-neutral-600 dark:text-gray-300">
                            {!props.booking?.eventType.recurringEvent
                              ? props.cancellationAllowed
                                ? t("reschedule_instead")
                                : t("event_is_in_the_past")
                              : allRemainingBookings
                              ? t("cancelling_all_recurring")
                              : t("cancelling_event_recurring")}
                          </p>
                        </div>
                        <div className="border-bookinglightest text-bookingdark mt-4 grid grid-cols-3 border-t py-4 text-left dark:border-gray-900 dark:text-gray-300">
                          <div className="font-medium">{t("what")}</div>
                          <div className="col-span-2 mb-6">{props.booking?.title}</div>
                          <div className="font-medium">{t("when")}</div>
                          <div className="col-span-2 mb-6">
                            {props.booking?.eventType.recurringEvent && props.recurringInstances ? (
                              <>
                                <div className="mb-1 inline py-1 text-left">
                                  <div>
                                    {dayjs(props.recurringInstances[0].startTime).format(
                                      detectBrowserTimeFormat + ", dddd DD MMMM YYYY"
                                    )}
                                    <Collapsible
                                      open={moreEventsVisible}
                                      onOpenChange={() => setMoreEventsVisible(!moreEventsVisible)}>
                                      <CollapsibleTrigger
                                        type="button"
                                        className={classNames(
                                          "-ml-4 block w-full text-center",
                                          moreEventsVisible ? "hidden" : ""
                                        )}>
                                        + {t("plus_more", { count: props.recurringInstances.length - 1 })}
                                      </CollapsibleTrigger>
                                      <CollapsibleContent>
                                        {props.booking?.eventType.recurringEvent?.count &&
                                          props.recurringInstances.slice(1).map((dateObj, idx) => (
                                            <div key={idx} className="">
                                              {dayjs(dateObj.startTime).format(
                                                detectBrowserTimeFormat + ", dddd DD MMMM YYYY"
                                              )}
                                            </div>
                                          ))}
                                      </CollapsibleContent>
                                    </Collapsible>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <>
                                {dayjs(props.booking?.startTime).format(
                                  detectBrowserTimeFormat + ", dddd DD MMMM YYYY"
                                )}{" "}
                                <span className="text-bookinglight">
                                  ({localStorage.getItem("timeOption.preferredTimeZone") || dayjs.tz.guess()})
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        {props.booking?.eventType.recurringEvent &&
                          props.booking?.eventType.recurringEvent.freq &&
                          props.recurringInstances && (
                            <div className="border-b text-center text-gray-500">
                              <Icon.FiRefreshCcw className="mr-3 -mt-1 ml-[2px] inline-block h-4 w-4 text-gray-400" />
                              <p className="mb-1 -ml-2 inline px-2 py-1">
                                {getEveryFreqFor({
                                  t,
                                  recurringEvent: props.booking.eventType.recurringEvent,
                                  recurringCount: props.recurringInstances.length,
                                })}
                              </p>
                            </div>
                          )}
                      </div>
                    </div>
                    {props.cancellationAllowed && (
                      <div>
                        <textarea
                          autoFocus={true}
                          name={t("cancellation_reason")}
                          placeholder={t("cancellation_reason_placeholder")}
                          value={cancellationReason}
                          onChange={(e) => setCancellationReason(e.target.value)}
                          className="mt-2 mb-3 w-full dark:border-gray-900 dark:bg-gray-700 dark:text-white sm:mb-3 "
                          rows={3}
                        />
                        <div className="flex justify-between space-x-2 text-center rtl:space-x-reverse">
                          {!props.booking.eventType?.recurringEvent && (
                            <Button color="secondary" onClick={() => router.push("/reschedule/" + uid)}>
                              {t("reschedule_this")}
                            </Button>
                          )}
                          <Button
                            data-testid="cancel"
                            onClick={async () => {
                              setLoading(true);

                              const payload = {
                                uid: uid,
                                cancellationReason: cancellationReason,
                                allRemainingBookings: !!props.recurringInstances,
                              };

                              telemetry.event(telemetryEventTypes.bookingCancelled, collectPageParameters());

                              const res = await fetch("/api/cancel", {
                                body: JSON.stringify(payload),
                                headers: {
                                  "Content-Type": "application/json",
                                },
                                method: "DELETE",
                              });

                              if (res.status >= 200 && res.status < 300) {
                                await router.push(
                                  `/cancel/success?name=${props.profile.name}&title=${
                                    props.booking.title
                                  }&eventPage=${props.profile.slug}&team=${
                                    props.booking.eventType?.team ? 1 : 0
                                  }&recurring=${!!props.recurringInstances}`
                                );
                              } else {
                                setLoading(false);
                                setError(
                                  `${t("error_with_status_code_occured", { status: res.status })} ${t(
                                    "please_try_again"
                                  )}`
                                );
                              }
                            }}
                            loading={loading}>
                            {t("cancel_event")}
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export const getServerSideProps = async (context: GetServerSidePropsContext) => {
  const ssr = await ssrInit(context);
  const session = await getSession(context);
  const { allRemainingBookings, uid } = querySchema.parse(context.query);
  const booking = await prisma.booking.findUnique({
    where: {
      uid,
    },
    select: {
      ...bookingMinimalSelect,
      recurringEventId: true,
      user: {
        select: {
          id: true,
          username: true,
          name: true,
          brandColor: true,
          darkBrandColor: true,
        },
      },
      eventType: {
        select: {
          length: true,
          recurringEvent: true,
          team: {
            select: {
              slug: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!booking) {
    // TODO: Booking is already cancelled
    return {
      props: { booking: null },
    };
  }

  const bookingObj = Object.assign({}, booking, {
    startTime: booking.startTime.toString(),
    endTime: booking.endTime.toString(),
    eventType: {
      ...booking.eventType,
      recurringEvent: parseRecurringEvent(booking.eventType?.recurringEvent),
    },
  });

  let recurringInstances = null;
  if (booking.eventType?.recurringEvent && allRemainingBookings) {
    recurringInstances = await prisma.booking.findMany({
      where: {
        recurringEventId: booking.recurringEventId,
        startTime: {
          gte: new Date(),
        },
        NOT: [{ status: "CANCELLED" }, { status: "REJECTED" }],
      },
      select: {
        startTime: true,
        endTime: true,
      },
    });
    recurringInstances = recurringInstances.map((recurr) => ({
      ...recurr,
      startTime: recurr.startTime.toString(),
      endTime: recurr.endTime.toString(),
    }));
  }

  const profile = {
    name: booking.eventType?.team?.name || booking.user?.name || null,
    slug: booking.eventType?.team?.slug || booking.user?.username || null,
    brandColor: booking.user?.brandColor || null,
    darkBrandColor: booking.user?.darkBrandColor || null,
  };

  return {
    props: {
      profile,
      booking: bookingObj,
      recurringInstances,
      cancellationAllowed:
        (!!session?.user && session.user?.id === booking.user?.id) || booking.startTime >= new Date(),
      trpcState: ssr.dehydrate(),
    },
  };
};
