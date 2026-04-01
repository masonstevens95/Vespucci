interface Props {
  title: string;
  description: string;
}

export const PlaceholderTab = ({ title, description }: Props) => (
  <div className="tab-placeholder">
    <h2>{title}</h2>
    <p>{description}</p>
  </div>
);
