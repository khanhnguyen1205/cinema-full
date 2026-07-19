import {
  Button,
  Tag,
  Badge,
  Card,
  Rule,
  Field,
  Skeleton,
  Spinner,
  IconButton,
  Numbered,
  KineticHeading,
  Marquee,
  Reveal,
  TicketEdge,
  Container,
  Section,
  Grid,
} from "components/ui";
import "./KitchenSink.css";

export default function KitchenSink() {
  return (
    <div className="ks">
      <Container>
        <h1>
          <KineticHeading text="KITCHEN SINK" />
        </h1>

        <div className="ks-block">
          <div className="ks-row">
            <Button>Solid</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="invert">Invert</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="ks-row">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </div>
        </div>

        <div className="ks-block">
          <div className="ks-row">
            <Tag>Mới</Tag>
            <Badge>8.4</Badge>
            <Badge tone="muted">180'</Badge>
            <Numbered n={1} />
            <Numbered n={12} />
          </div>
          <Rule />
          <div className="ks-row">
            <IconButton label="Thông báo">
              <span aria-hidden="true">🔔</span>
            </IconButton>
            <Spinner />
            <Skeleton width="160px" height="20px" />
          </div>
        </div>

        <div className="ks-block">
          <Field label="Email">
            <input placeholder="you@email.com" />
          </Field>
        </div>

        <div className="ks-block u-invert" style={{ padding: 24 }}>
          <p>Khối đảo màu "bone" (chữ đen nền ngà).</p>
        </div>

        <Marquee speed={18}>
          <span style={{ paddingRight: 40 }}>
            DUNE · OPPENHEIMER · JOKER · AVENGERS ·&nbsp;
          </span>
        </Marquee>

        <Section label="Đang chiếu" index={2}>
          <Grid min="200px">
            <Card style={{ height: 120 }} />
            <Card style={{ height: 120 }} />
            <Card style={{ height: 120 }} />
          </Grid>
        </Section>

        <Reveal>
          <TicketEdge>
            <div style={{ padding: 24 }}>Vé xé (mép đục lỗ) + Reveal.</div>
          </TicketEdge>
        </Reveal>
      </Container>
    </div>
  );
}
