import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export interface FaqItem {
  q: string;
  a: string;
}

export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <Accordion className="mk-card rounded-2xl px-5 sm:px-6">
      {items.map((item, i) => (
        <AccordionItem key={i} value={`faq-${i}`} className="border-border">
          <AccordionTrigger className="py-5 text-[15px] font-medium hover:no-underline">{item.q}</AccordionTrigger>
          <AccordionContent className="pb-5 text-[14.5px] leading-relaxed text-muted-foreground">
            <p>{item.a}</p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
